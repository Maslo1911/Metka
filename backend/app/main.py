from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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