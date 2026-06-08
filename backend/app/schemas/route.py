from typing import Literal, Optional, List

from pydantic import BaseModel

# Sensory intensity on a route: 1 = Low, 2 = Medium, 3 = High, 4 = Extreme.
SensoryLevel = Literal[1, 2, 3, 4]

# Route classification surfaced to the client.
RouteType = Literal["best", "quickest", "suggested"]


class LegOption(BaseModel):
    """Details of an individual journey leg, transit or walking."""
    mode: str
    line: str
    duration_mins: int
    departure: str
    arrival: str
    instruction: str
    stops: Optional[List[str]] = None
    connection_waiting_mins: Optional[int] = 0
    departure_lat: Optional[float] = None
    departure_lon: Optional[float] = None
    arrival_lat: Optional[float] = None
    arrival_lon: Optional[float] = None
    path_coords: Optional[List[List[float]]] = None


class RouteFeature(BaseModel):
    """Color-coded sensory/efficiency feature badge for the route card."""
    type: str
    label: str
    icon: str
    color: str


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
    legs: Optional[List[LegOption]] = None
    features: Optional[List[RouteFeature]] = None
    # Always populated by the route service before the response is built.
    type: RouteType


class WarningItemSchema(BaseModel):
    """Client-facing live warning item schema, filtered by user sensory sensitivities."""
    id: str
    title: str
    desc: str
    severity: Literal["high", "medium", "info"]
    icon: str
    lat: Optional[float] = None
    lon: Optional[float] = None


class ReportWarningSchema(BaseModel):
    """Request schema for reporting a sensory warning."""
    id: str
    username: str
    warning_type: str
    title: str
    desc: str
    lat: float
    lon: float



class LocationSuggestion(BaseModel):
    """Schema for autocomplete location suggestions."""
    name: str
    display_name: str
    subtitle: Optional[str] = None
    lat: float
    lon: float


