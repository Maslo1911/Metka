from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.dependencies import DbSession, CurrentUser
from app.models import Note, Tag, NoteTag
from app.schemas import NoteCreate, NoteUpdate, NoteOut, NoteWithTag

router = APIRouter(prefix="/api/notes", tags=["Notes"])


def _normalize_note_tag_ids(data: NoteCreate | NoteUpdate, current_user: CurrentUser, db: Session) -> list[int]:
    raw_ids = list(data.tag_ids) if data.tag_ids is not None else []
    if data.tag_id is not None:
        if data.tag_id == 0:
            return []
        raw_ids = [data.tag_id] if not raw_ids else raw_ids

    unique_ids = []
    seen = set()
    for tag_id in raw_ids:
        if tag_id in seen:
            continue
        seen.add(tag_id)
        if tag_id == 0:
            continue
        tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user.id).first()
        if not tag:
            raise HTTPException(status_code=400, detail="Тег не найден или чужой")
        unique_ids.append(tag_id)
    return unique_ids


@router.get("", response_model=List[NoteWithTag])
def list_notes(
    db: DbSession,
    current_user: CurrentUser,
    search: Optional[str] = Query(None, description="Поиск по title/text"),
    tag_id: Optional[int] = Query(None, description="Фильтр по тегу"),
):
    """Все заметки текущего пользователя (с тегами)."""
    q = (
        db.query(Note)
        .options(joinedload(Note.tags))
        .filter(Note.user_id == current_user.id)
    )
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            (Note.title.ilike(pattern)) | (Note.text.ilike(pattern))
        )
    if tag_id is not None:
        q = q.filter(Note.id.in_(
            db.query(NoteTag.note_id).filter(NoteTag.tag_id == tag_id)
        ))

    return q.order_by(Note.date.desc()).all()


@router.get("/{note_id}", response_model=NoteWithTag)
def get_note(note_id: int, db: DbSession, current_user: CurrentUser):
    """Одна заметка по id (только своя)."""
    note = (
        db.query(Note)
        .options(joinedload(Note.tags))
        .filter(Note.id == note_id, Note.user_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return note


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(data: NoteCreate, db: DbSession, current_user: CurrentUser):
    """Создать заметку."""
    tag_ids = _normalize_note_tag_ids(data, current_user, db)

    note = Note(title=data.title, text=data.text, user_id=current_user.id)
    db.add(note)
    db.commit()
    db.refresh(note)

    if tag_ids:
        note.tags = db.query(Tag).filter(Tag.id.in_(tag_ids), Tag.user_id == current_user.id).all()
        db.commit()
        db.refresh(note)

    return note


@router.patch("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: int,
    data: NoteUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    """Обновить заметку (частично)."""
    note = db.query(Note).filter(
        Note.id == note_id, Note.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")

    if data.title is not None:
        note.title = data.title
    if data.text is not None:
        note.text = data.text

    if data.tag_ids is not None or data.tag_id is not None:
        tag_ids = _normalize_note_tag_ids(data, current_user, db)
        note.tags = db.query(Tag).filter(Tag.id.in_(tag_ids), Tag.user_id == current_user.id).all()

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, db: DbSession, current_user: CurrentUser):
    """Удаляет заметку и все её связи с тегами."""
    note = db.query(Note).filter(
        Note.id == note_id, Note.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")

    db.delete(note)
    db.commit()
    return None