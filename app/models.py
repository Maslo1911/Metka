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


class Tag(Base):
    __tablename__ = "tag"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    note_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("note.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped["User"] = relationship("User", back_populates="tags")
    # ↓ Связь Tag → Note. back_populates НЕ используем,
    #   потому что это независимая связь, а не обратная к Note.tags.
    note: Mapped[Optional["Note"]] = relationship(
        "Note",
        foreign_keys=[note_id],
        backref="tags_linked",  # можно дать любое имя, чтобы не конфликтовало
        post_update=True,       # важно: убирает циклическую зависимость при INSERT
    )


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
    tag_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tag.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped["User"] = relationship("User", back_populates="notes")
    # ↓ Связь Note → Tag. Тоже независимая, back_populates не используем.
    tag: Mapped[Optional["Tag"]] = relationship(
        "Tag",
        foreign_keys=[tag_id],
        backref="notes_linked",
        post_update=True,
    )