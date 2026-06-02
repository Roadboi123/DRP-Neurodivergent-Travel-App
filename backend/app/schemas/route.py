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
    """

    id: str
    name: str
    subName: Optional[str] = None
    duration: int
    price: float
    noise: int
    crowds: int
    heat: int
    light: int
    smell: int
    description: str
    sensory_score: Optional[float] = None
    match_percentage: Optional[int] = None
    sensory_description: Optional[str] = None
    type: Optional[RouteType] = None
