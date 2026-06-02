from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import diagnostics, health, preferences, routes
from app.config import settings

app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(diagnostics.router)
app.include_router(preferences.router)
app.include_router(routes.router)


@app.get("/")
async def root():
    return {"message": "Backend running"}
