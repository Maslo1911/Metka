from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict


# ---------- Auth ----------

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    login: Optional[str] = None


class UserLogin(BaseModel):
    login: str
    password: str


class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    login: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)


# ---------- User ----------

class UserBase(BaseModel):
    name: str
    login: str


class UserOut(UserBase):
    id: int
    role_id: int
    model_config = ConfigDict(from_attributes=True)


class UserWithRole(UserOut):
    role_name: Optional[str] = None


# ---------- Tag ----------

class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = Field(None, max_length=20)


class TagCreate(TagBase):
    note_id: Optional[int] = None


class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = Field(None, max_length=20)
    note_id: Optional[int] = None


class TagOut(TagBase):
    id: int
    user_id: int
    note_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


# ---------- Note ----------

class NoteBase(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    text: Optional[str] = None


class NoteCreate(NoteBase):
    tag_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    text: Optional[str] = None
    tag_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None


class NoteOut(NoteBase):
    id: int
    date: Optional[datetime] = None
    user_id: int
    tag_id: Optional[int] = None
    tag_ids: List[int] = Field(default_factory=list)
    tags: List[TagOut] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class NoteWithTag(NoteOut):
    tag: Optional[TagOut] = None


# ---------- Role / Permission (read-only для API) ----------

class RoleOut(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class PermissionOut(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)