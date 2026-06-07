from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_username, oauth2_scheme
from app.schemas.preset import PresetsPayload, PresetsResponse
from app.services import presets as presets_service

router = APIRouter(prefix="/presets", tags=["presets"])


@router.post("/", status_code=200, response_model=PresetsResponse)
def save_presets(
    payload: PresetsPayload,
    token: Optional[str] = Depends(oauth2_scheme),
):
    """Replace the signed-in user's three preset profiles and active selection."""
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required")
    try:
        # Override username from the token to enforce authentication integrity.
        payload.username = get_current_username(token)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    try:
        return presets_service.save_presets(payload)
    except presets_service.PresetPersistenceError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{username}", response_model=PresetsResponse)
def get_presets(
    username: str,
    token: Optional[str] = Depends(oauth2_scheme),
):
    resolved_username = username
    if username == "me":
        if not token:
            raise HTTPException(status_code=401, detail="Authentication token required for 'me' path")
        resolved_username = get_current_username(token)

    try:
        presets = presets_service.get_presets(resolved_username)
    except presets_service.PresetPersistenceError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if presets is None:
        raise HTTPException(status_code=404, detail="Presets not found")

    return presets
