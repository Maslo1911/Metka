from typing import List

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import DbSession, CurrentUser
from app.models import Tag, Note
from app.schemas import TagCreate, TagUpdate, TagOut

router = APIRouter(prefix="/api/tags", tags=["Tags"])


@router.get("", response_model=List[TagOut])
def list_tags(db: DbSession, current_user: CurrentUser):
    """все теги челика"""
    return (
        db.query(Tag)
        .filter(Tag.user_id == current_user.id)
        .order_by(Tag.name)
        .all()
    )


@router.get("/{tag_id}", response_model=TagOut)
def get_tag(tag_id: int, db: DbSession, current_user: CurrentUser):
    tag = db.query(Tag).filter(
        Tag.id == tag_id, Tag.user_id == current_user.id
    ).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Тег не найден")
    return tag


@router.post("", response_model=TagOut, status_code=status.HTTP_201_CREATED)
def create_tag(data: TagCreate, db: DbSession, current_user: CurrentUser):
    """создание тега"""
    if data.note_id is not None:
        note = db.query(Note).filter(
            Note.id == data.note_id, Note.user_id == current_user.id
        ).first()
        if not note:
            raise HTTPException(status_code=400, detail="Заметка не найдена или чужая")

    tag = Tag(
        name=data.name,
        color=data.color,
        user_id=current_user.id,
        note_id=data.note_id,
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)

    if data.note_id is not None:
        note = db.get(Note, data.note_id)
        if note:
            note.tag_id = tag.id
            db.commit()

    return tag


@router.patch("/{tag_id}", response_model=TagOut)
def update_tag(
    tag_id: int,
    data: TagUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    tag = db.query(Tag).filter(
        Tag.id == tag_id, Tag.user_id == current_user.id
    ).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Тег не найден")

    if data.name is not None:
        tag.name = data.name
    if data.color is not None:
        tag.color = data.color

    if data.note_id is not None:
        if data.note_id == 0:
            if tag.note_id:
                note = db.get(Note, tag.note_id)
                if note:
                    note.tag_id = None
            tag.note_id = None
        else:
            note = db.query(Note).filter(
                Note.id == data.note_id, Note.user_id == current_user.id
            ).first()
            if not note:
                raise HTTPException(status_code=400, detail="Заметка не найдена или чужая")
            if tag.note_id and tag.note_id != data.note_id:
                old_note = db.get(Note, tag.note_id)
                if old_note:
                    old_note.tag_id = None
            tag.note_id = data.note_id
            note.tag_id = tag.id

    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, db: DbSession, current_user: CurrentUser):
    tag = db.query(Tag).filter(
        Tag.id == tag_id, Tag.user_id == current_user.id
    ).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Тег не найден")

    if tag.note_id:
        note = db.get(Note, tag.note_id)
        if note:
            note.tag_id = None

    db.delete(tag)
    db.commit()
    return None