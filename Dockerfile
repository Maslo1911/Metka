# ---- 1. Сборка фронтенда ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Бэкенд + собранный фронтенд ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Render/Railway/Koyeb передают порт через $PORT
ENV PORT=8000
EXPOSE 8000
CMD python -m app.init_db && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
