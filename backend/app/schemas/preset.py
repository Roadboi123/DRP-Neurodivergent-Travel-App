from typing import List, Literal

from pydantic import BaseModel

from app.schemas.preference import SensitivityLevel

# Slots for the three switchable preset profiles a user can save. Fixed set: the
# frontend renders exactly these as "Preset 1 / 2 / 3".
PresetId = Literal["p1", "p2", "p3"]


class Preset(BaseModel):
    """One saved preset profile: a name plus a full set of sensitivities.

    Reuses the ``SensitivityLevel`` literal from the preferences contract so the
    accepted labels stay a single source of truth (invalid values 422 before the
    handler runs). Every dimension is required — a preset is always fully set.
    """

    id: PresetId
    name: str
    noise: SensitivityLevel
    crowds: SensitivityLevel
    temperature: SensitivityLevel
    smell: SensitivityLevel
    lights: SensitivityLevel


class PresetsPayload(BaseModel):
    """Request body for ``POST /presets/`` — replaces a user's whole preset set.

    The active preset's values are mirrored into ``user_sensitivities`` so route
    scoring (the frozen ``GET /routes/``) keeps reading the same row as before.
    """

    username: str
    active_id: PresetId
    presets: List[Preset]


class PresetsResponse(BaseModel):
    """Response body for ``GET /presets/{username}``."""

    username: str
    active_id: PresetId
    presets: List[Preset]
