from fastapi import APIRouter, HTTPException

from app.schemas.preference import PreferenceResponse, SensitivityPreferences
from app.services import preferences as preferences_service

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.post("/", status_code=201)
def save_preferences(prefs: SensitivityPreferences):
    """Save sensory preferences from the user preferences screen."""
    try:
        username = preferences_service.save_preferences(prefs)
    except preferences_service.PreferencePersistenceError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        "username": username,
        "message": "Preferences saved successfully",
    }


@router.get("/{username}", response_model=PreferenceResponse)
def get_preferences(username: str):
    try:
        prefs = preferences_service.get_preferences(username)
    except preferences_service.PreferencePersistenceError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if prefs is None:
        raise HTTPException(status_code=404, detail="Preferences not found")

    return prefs
