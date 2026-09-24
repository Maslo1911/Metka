from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.dependencies import DbSession, CurrentUser
from app.models import Note, Tag
from app.schemas import NoteCreate, NoteUpdate, NoteOut, NoteWithTag

router = APIRouter(prefix="/api/notes", tags=["Notes"])


@router.get("", response_model=List[NoteWithTag])
def list_notes(
    db: DbSession,
    current_user: CurrentUser,
    search: Optional[str] = Query(None, description="Поиск по title/text"),
    tag_id: Optional[int] = Query(None, description="Фильтр по тегу"),
):
    """Все заметки текущего пользователя (с тегом)."""
    q = (
        db.query(Note)
        .options(joinedload(Note.tag))
        .filter(Note.user_id == current_user.id)
    )
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            (Note.title.ilike(pattern)) | (Note.text.ilike(pattern))
        )
    if tag_id is not None:
        q = q.filter(Note.tag_id == tag_id)

    return q.order_by(Note.date.desc()).all()


@router.get("/{note_id}", response_model=NoteWithTag)
def get_note(note_id: int, db: DbSession, current_user: CurrentUser):
    """Одна заметка по id (только своя)."""
    note = (
        db.query(Note)
        .options(joinedload(Note.tag))
        .filter(Note.id == note_id, Note.user_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return note


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(data: NoteCreate, db: DbSession, current_user: CurrentUser):
    """Создать заметку."""
    if data.tag_id is not None:
        tag = db.query(Tag).filter(
            Tag.id == data.tag_id, Tag.user_id == current_user.id
        ).first()
        if not tag:
            raise HTTPException(status_code=400, detail="Тег не найден или чужой")

    note = Note(
        title=data.title,
        text=data.text,
        user_id=current_user.id,
        tag_id=data.tag_id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    # Синхронизация двусторонней связи (как на ERD)
    if data.tag_id is not None:
        tag = db.get(Tag, data.tag_id)
        if tag:
            tag.note_id = note.id
            db.commit()

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

    if data.tag_id is not None:
        if data.tag_id == 0:
            # сброс тега
            if note.tag_id:
                old_tag = db.get(Tag, note.tag_id)
                if old_tag:
                    old_tag.note_id = None
            note.tag_id = None
        else:
            tag = db.query(Tag).filter(
                Tag.id == data.tag_id, Tag.user_id == current_user.id
            ).first()
            if not tag:
                raise HTTPException(status_code=400, detail="Тег не найден или чужой")
            # отвязать старый тег
            if note.tag_id and note.tag_id != data.tag_id:
                old_tag = db.get(Tag, note.tag_id)
                if old_tag:
                    old_tag.note_id = None
            note.tag_id = data.tag_id
            tag.note_id = note.id

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, db: DbSession, current_user: CurrentUser):
    """делит заметки"""
    note = db.query(Note).filter(
        Note.id == note_id, Note.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")

    # отвязать тег
    if note.tag_id:
        tag = db.get(Tag, note.tag_id)
        if tag:
            tag.note_id = None

    db.delete(note)
    db.commit()
    return None