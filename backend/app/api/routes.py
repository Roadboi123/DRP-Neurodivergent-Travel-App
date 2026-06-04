from typing import List, Optional
import jwt
from fastapi import APIRouter, Depends

from app.schemas.route import RouteOption
from app.services.routes import get_route_suggestions
from app.api.auth import oauth2_scheme, ALGORITHM, JWT_SECRET

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
