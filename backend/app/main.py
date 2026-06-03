from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from app.api.routes import routes_router
from app.api.health import health_router
from app.api.database_health import dbrouter
from app.api.preferences import pref_router
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="Calm Travel API",
    version="0.1.0"
)


origins = [
    "https://drp10-nd-travel-app.vercel.app",
    "http://localhost:19006",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:3000",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(dbrouter)
app.include_router(pref_router)
app.include_router(routes_router)

@app.get("/")
async def root():
    return {"message": "Backend running"}