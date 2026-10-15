from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

db_url = settings.DATABASE_URL
# Облачные провайдеры (Render, Heroku) отдают URL вида postgres://
for prefix in ("postgresql://", "postgres://"):
    if db_url.startswith(prefix):
        db_url = db_url.replace(prefix, "postgresql+psycopg://", 1)
        break

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()