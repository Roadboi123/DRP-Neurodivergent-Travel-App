from fastapi import FastAPI
# from app.api.routes import router
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
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(dbrouter)
app.include_router(pref_router)

@app.get("/")
async def root():
    return {"message": "Backend running"}