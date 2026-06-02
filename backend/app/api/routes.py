from typing import List, Optional

from fastapi import APIRouter

from app.schemas.route import RouteOption
from app.services.routes import get_route_suggestions

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("/", response_model=List[RouteOption])
def get_routes(start: str, end: str, username: Optional[str] = None):
    """Return route suggestions, optionally personalized to a user's sensitivities."""
    return get_route_suggestions(start, end, username)
