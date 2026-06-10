from typing import List, Optional
import jwt
from fastapi import APIRouter, Depends, HTTPException

from app.schemas.route import RouteOption, WarningItemSchema, LocationSuggestion, ReportWarningSchema
from app.services.routes import get_route_suggestions, get_user_warnings, is_duplicate_report
from app.api.auth import oauth2_scheme, ALGORITHM, JWT_SECRET
from app.integrations.tlf_client import clean_station_name

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("/", response_model=List[RouteOption])
async def get_routes(
    start: str,
    end: str,
    username: Optional[str] = None,
    walking_speed: Optional[str] = "slow",
    token: Optional[str] = Depends(oauth2_scheme),
):
    """Return route suggestions, optionally personalized to a user's sensitivities."""
    resolved_username = username
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            token_username = payload.get("sub")
            if token_username:
                resolved_username = token_username
        except Exception:
            pass
            
    return await get_route_suggestions(start, end, resolved_username, walking_speed)


@router.get("/warnings", response_model=List[WarningItemSchema])
async def get_routes_warnings(
    username: Optional[str] = None,
    generic: Optional[bool] = False,
    lines: Optional[str] = None,
    stations: Optional[str] = None,
    token: Optional[str] = Depends(oauth2_scheme),
):
    """Return live warnings tailored to the user's sensory sensitivities.
    
    Pass `lines` (comma-separated TfL line names, e.g. "Elizabeth,Piccadilly") and
    `stations` (comma-separated station names) from the fetched route legs so that
    disruption and works warnings are filtered to only those relevant to the journey.
    """
    resolved_username = username
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            token_username = payload.get("sub")
            if token_username:
                resolved_username = token_username
        except Exception:
            pass

    # Only include non-empty line names (walking legs produce an empty string).
    route_lines: set[str] = set()
    if lines:
        route_lines = {ln.strip().lower() for ln in lines.split(",") if ln.strip()}

    # Apply the same name-cleaning that get_live_station_works uses so that
    # "Stanmore Underground Station" → "stanmore" matches "Stanmore" → "stanmore".
    route_stations: set[str] = set()
    if stations:
        route_stations = {
            clean_station_name(s.strip())
            for s in stations.split(",")
            if s.strip()
        }

    return await get_user_warnings(
        resolved_username,
        generic=bool(generic),
        route_lines=route_lines,
        route_stations=route_stations,
    )


@router.get("/suggest-locations", response_model=List[LocationSuggestion])
async def suggest_locations(q: str, user_coords: Optional[str] = None):
    """Return autocomplete location suggestions prioritizing Greater London and correcting typos."""
    from app.integrations.osm_client import suggest_locations as osm_suggest_locations
    user_lat, user_lon = None, None
    if user_coords:
        try:
            parts = user_coords.split(",")
            if len(parts) == 2:
                user_lat = float(parts[0])
                user_lon = float(parts[1])
        except ValueError:
            pass
    return await osm_suggest_locations(q, user_lat, user_lon)


@router.post("/warnings/report", response_model=WarningItemSchema)
async def report_warning(body: ReportWarningSchema):
    """Save a user-reported sensory warning to the database so other users can see it.

    Rejects with 409 if a same-type warning was already reported nearby (anti-spam).
    """
    from app.integrations.supabase import supabase

    if is_duplicate_report(body.warning_type, body.lat, body.lon):
        raise HTTPException(
            status_code=409,
            detail="A similar warning has already been reported nearby.",
        )

    supabase.table("reported_warnings").insert({
        "id": body.id,
        "username": body.username,
        "warning_type": body.warning_type,
        "title": body.title,
        "description": body.desc,
        "lat": body.lat,
        "lon": body.lon,
    }).execute()
    
    return WarningItemSchema(
        id=body.id,
        title=body.title,
        desc=body.desc,
        severity="medium",
        icon=body.warning_type,
        lat=body.lat,
        lon=body.lon,
        username=body.username,
    )


@router.delete("/warnings/{warning_id}")
async def delete_warning(warning_id: str, username: str):
    """Delete a user-reported warning from the database.

    Owner-only: a warning is removed for everyone only when ``username`` matches
    the reporter. Other users dismiss a warning locally (client-side), never via
    this endpoint. Returns ``deleted`` so the client knows whether a row went.
    """
    from app.integrations.supabase import supabase
    res = (
        supabase.table("reported_warnings")
        .delete()
        .eq("id", warning_id)
        .eq("username", username)
        .execute()
    )
    deleted = bool(getattr(res, "data", None))
    return {"status": "success", "deleted": deleted, "id": warning_id}



