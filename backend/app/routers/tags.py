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
    note = None
    if data.note_id is not None:
        note = db.query(Note).filter(
            Note.id == data.note_id, Note.user_id == current_user.id
        ).first()
        if not note:
            raise HTTPException(status_code=400, detail="Заметка не найдена или чужая")

    tag = Tag(name=data.name, color=data.color, user_id=current_user.id)
    db.add(tag)
    db.commit()
    db.refresh(tag)

    if note is not None:
        note.tags.append(tag)
        db.commit()
        db.refresh(tag)

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
        note = db.query(Note).filter(
            Note.id == data.note_id, Note.user_id == current_user.id
        ).first()
        if not note:
            raise HTTPException(status_code=400, detail="Заметка не найдена или чужая")
        if data.note_id == 0:
            note.tags = [existing_tag for existing_tag in note.tags if existing_tag.id != tag.id]
        else:
            if tag not in note.tags:
                note.tags.append(tag)

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

    db.delete(tag)
    db.commit()
    return None