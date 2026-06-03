from typing import Literal, Optional

from pydantic import BaseModel

# Client-facing sensitivity labels, ordered from least to most affected. This is
# the single source of truth for the preference contract: the frontend's TS union
# is generated from these schemas.
SensitivityLevel = Literal["little", "medium", "high", "veryhigh"]

# Accepted sensitivity labels and their stored integer encodings. Higher integer
# = more strongly affected (drives a larger discomfort weight in route scoring).
SENSITIVITY_MAP: dict[SensitivityLevel, int] = {
    "little": 1,
    "medium": 2,
    "high": 3,
    "veryhigh": 4,
}


class SensitivityPreferences(BaseModel):
    """Request body for ``POST /preferences/``.

    The ``SensitivityLevel`` literal enforces the accepted labels, so invalid
    values are rejected with a 422 before the handler runs.
    """

    username: str
    noise: SensitivityLevel
    crowds: SensitivityLevel
    temperature: SensitivityLevel
    smell: SensitivityLevel
    lights: SensitivityLevel


class PreferenceResponse(BaseModel):
    """Response body for ``GET /preferences/{username}``.

    Sensitivity fields are always one of the ``SensitivityLevel`` labels (the
    service maps stored integers back through ``REVERSE_SENSITIVITY_MAP``) or
    ``None`` when a column is unset.
    """

    username: str
    noise: Optional[SensitivityLevel] = None
    crowds: Optional[SensitivityLevel] = None
    temperature: Optional[SensitivityLevel] = None
    smell: Optional[SensitivityLevel] = None
    lights: Optional[SensitivityLevel] = None
