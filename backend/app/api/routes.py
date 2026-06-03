from typing import List, Optional

from fastapi import APIRouter

from app.schemas.route import RouteOption
from app.services.routes import get_route_suggestions

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("/", response_model=List[RouteOption])
async def get_routes(
    start: str,
    end: str,
    username: Optional[str] = None,
    walking_speed: Optional[str] = "slow",
):
    """Return route suggestions, optionally personalized to a user's sensitivities."""
    return await get_route_suggestions(start, end, username, walking_speed)
