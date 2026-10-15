"""
Инициализация БД при старте контейнера:
1. Если таблиц ещё нет — применяет schema.sql (схема + тестовые данные).
2. Если задан ADMIN_PASSWORD — выставляет этот пароль пользователю admin
   (в schema.sql у тестовых пользователей заглушки вместо bcrypt-хэшей).
"""
import os
from pathlib import Path

from sqlalchemy import inspect, text

from app.core.security import get_password_hash
from app.database import engine

SCHEMA = Path(__file__).resolve().parents[1] / "schema.sql"


def main() -> None:
    if not inspect(engine).has_table("user"):
        print("init_db: таблиц нет, применяю schema.sql")
        # Скрипт сам управляет транзакцией (BEGIN/COMMIT) — выполняем его
        # напрямую драйвером psycopg в режиме autocommit, одним запросом
        raw = engine.raw_connection()
        try:
            raw.driver_connection.autocommit = True
            raw.driver_connection.execute(SCHEMA.read_text(encoding="utf-8"))
        finally:
            raw.close()
    else:
        print("init_db: схема уже есть, пропускаю")

    admin_password = os.getenv("ADMIN_PASSWORD")
    if admin_password:
        with engine.begin() as conn:
            conn.execute(
                text('UPDATE "user" SET password = :p WHERE login = :l'),
                {"p": get_password_hash(admin_password), "l": os.getenv("ADMIN_LOGIN", "admin")},
            )
        print("init_db: пароль администратора обновлён")


if __name__ == "__main__":
    main()
