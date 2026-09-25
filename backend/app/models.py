"""
SQLAlchemy-модели строго по ERD (images/erd metka.png).
Связи tag↔note — две независимые, как на диаграмме.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String, Text, Integer, ForeignKey, TIMESTAMP, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Permission(Base):
    __tablename__ = "permission"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)


class Role(Base):
    __tablename__ = "role"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    users: Mapped[list["User"]] = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    login: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("role.id", ondelete="RESTRICT"), nullable=False
    )

    role: Mapped["Role"] = relationship("Role", back_populates="users")
    notes: Mapped[list["Note"]] = relationship(
        "Note", back_populates="user", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(
        "Tag", back_populates="user", cascade="all, delete-orphan"
    )


class NoteTag(Base):
    __tablename__ = "note_tag"

    note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("note.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True
    )


class Tag(Base):
    __tablename__ = "tag"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="tags")
    notes: Mapped[list["Note"]] = relationship(
        "Note",
        secondary="note_tag",
        back_populates="tags",
    )

    @property
    def note_id(self) -> Optional[int]:
        return self.notes[0].id if self.notes else None


class Note(Base):
    __tablename__ = "note"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP, server_default=func.now(), nullable=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="notes")
    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary="note_tag",
        back_populates="notes",
    )

    @property
    def tag_id(self) -> Optional[int]:
        return self.tags[0].id if self.tags else None

    @property
    def tag_ids(self) -> list[int]:
        return [tag.id for tag in self.tags]