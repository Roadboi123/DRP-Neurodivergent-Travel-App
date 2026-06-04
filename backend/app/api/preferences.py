from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from app.schemas.preference import PreferenceResponse, SensitivityPreferences
from app.services import preferences as preferences_service
from app.api.auth import oauth2_scheme, get_current_username

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.post("/", status_code=201)
def save_preferences(
    prefs: SensitivityPreferences,
    token: Optional[str] = Depends(oauth2_scheme)
):
    """Save sensory preferences from the user preferences screen."""
    if token:
        try:
            token_username = get_current_username(token)
            # Override username in payload to enforce authentication integrity
            prefs.username = token_username
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
            
    try:
        username = preferences_service.save_preferences(prefs)
    except preferences_service.PreferencePersistenceError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        "username": username,
        "message": "Preferences saved successfully",
    }


@router.get("/{username}", response_model=PreferenceResponse)
def get_preferences(
    username: str,
    token: Optional[str] = Depends(oauth2_scheme)
):
    resolved_username = username
    if username == "me":
        if not token:
            raise HTTPException(status_code=401, detail="Authentication token required for 'me' path")
        resolved_username = get_current_username(token)
        
    try:
        prefs = preferences_service.get_preferences(resolved_username)
    except preferences_service.PreferencePersistenceError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if prefs is None:
        raise HTTPException(status_code=404, detail="Preferences not found")

    return prefs
