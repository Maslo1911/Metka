# Metka

## Стек
FastAPI, SQLAlchemy, PostgreSQL, JWT

## Запуск
1. Установить PostgreSQL, создать БД `metka`.
2. Склонировать репозиторий, перейти в папку.
3. Создать venv и активировать:
   ```
   python -m venv .venv
   .venv\Scripts\activate
   ```
4. Установить зависимости:
   ```
   pip install -r requirements.txt
   ```
5. Убедиться, что в `app/core/config.py` правильный `DATABASE_URL`
   (по умолчанию: `postgresql://postgres:postgres@localhost:5432/metka`).
6. Запустить:
   ```
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
7. Открыть Swagger: http://localhost:8000/docs

## API
Все эндпоинты — в Swagger (`/docs`).
Авторизация: `Authorization: Bearer <token>`.
Токен получается через `POST /api/auth/login` (form-data: username, password).