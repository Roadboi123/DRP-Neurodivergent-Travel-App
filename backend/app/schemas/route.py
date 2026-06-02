from typing import Literal, Optional

from pydantic import BaseModel

# Sensory intensity on a route: 1 = Low, 2 = Medium, 3 = High.
SensoryLevel = Literal[1, 2, 3]

# Route classification surfaced to the client.
RouteType = Literal["best", "quickest", "suggested"]


class RouteOption(BaseModel):
    """A single route suggestion returned by ``GET /routes/``.

    Field names mirror the contract the React Native client consumes exactly,
    including the camelCase ``subName`` alongside the snake_case sensory fields.
    This model is the single source of truth for the route contract: the
    frontend's TS types are generated from it (see ``shared/`` and
    ``scripts/export_openapi.py``). Annotations are kept precise so the generated
    types are precise, but JSON serialization is unchanged (``SensoryLevel`` still
    serializes as the integers 1/2/3).
    """

    id: str
    name: str
    subName: Optional[str] = None
    duration: int
    price: float
    noise: SensoryLevel
    crowds: SensoryLevel
    heat: SensoryLevel
    light: SensoryLevel
    smell: SensoryLevel
    description: str
    sensory_score: Optional[float] = None
    match_percentage: Optional[int] = None
    sensory_description: Optional[str] = None
    # Always populated by the route service before the response is built.
    type: RouteType
