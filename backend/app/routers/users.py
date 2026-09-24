from typing import List

from fastapi import APIRouter, HTTPException, status

from app.dependencies import DbSession, CurrentUser, CurrentAdmin
from app.models import User
from app.schemas import UserOut, UserWithRole

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=UserWithRole)
def get_me(current_user: CurrentUser, db: DbSession):
    """текуший пользователь"""
    return UserWithRole(
        id=current_user.id,
        name=current_user.name,
        login=current_user.login,
        role_id=current_user.role_id,
        role_name=current_user.role.name if current_user.role else None,
    )


@router.get("", response_model=List[UserOut])
def list_users(db: DbSession, admin: CurrentAdmin):
    """Список всех челиков(только админ)"""
    return db.query(User).order_by(User.id).all()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: DbSession, admin: CurrentAdmin):
    """делит челика (только админ). вместе с ним удаляются и заместки"""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить самого себя",
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.delete(user)
    db.commit()
    return None