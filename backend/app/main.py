from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.routers import auth, notes, tags, users

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "REST API серви Metka — заметки с тегами.\n\n"
        "### Возможности\n"
        "- Регистрация / вход (JWT)\n"
        "- CRUD заметок (поиск, фильтр по тегу)\n"
        "- CRUD тегов (цвет, привязка к заметке)\n"
        "- Профиль пользователя\n"
        "- Админ: список и удаление пользователей\n\n"
        "### Авторизация\n"
        "1. `POST /api/auth/login` → получить `access_token`\n"
        "2. В Swagger нажать **Authorize** и вставить `Bearer <token>`\n"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — чтобы фронтенд мог ходить на API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # в проде указать конкретные домены
    allow_credentials=False, # если куки то True
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(tags.router)
app.include_router(users.router)


# Собранный фронтенд (npm run build → frontend/dist). Если папки нет — работаем как чистый API.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if not FRONTEND_DIST.is_dir():
    @app.get("/", tags=["Health"])
    def root():
        return {
            "service": settings.APP_NAME,
            "status": "ok",
            "docs": "/docs",
        }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    # SPA-фолбэк: любой путь, не относящийся к API, отдаёт index.html
    # (роутинг /tags, /notes/5 и т.д. выполняет сам React). Регистрируется последним.
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (FRONTEND_DIST / full_path).resolve()
        if full_path and candidate.is_file() and FRONTEND_DIST in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
