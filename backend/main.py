from fastapi import FastAPI
# from app.api.routes import router
from app.api.health import health_router

app = FastAPI(
    title="Calm Travel API",
    version="0.1.0"
)

app.include_router(health_router)
# app.include_router(router)

@app.get("/")
async def root():
    return {"message": "Backend running"}