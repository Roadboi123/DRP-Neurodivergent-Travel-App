from typing import Optional

from pydantic import BaseModel, field_validator

# Accepted sensitivity labels and their stored integer encodings.
SENSITIVITY_MAP = {
    "little": 1,
    "manageable": 2,
    "dontcare": 3,
}


class SensitivityPreferences(BaseModel):
    """Request body for ``POST /preferences/``."""

    username: str
    noise: str
    crowds: str
    temperature: str
    smell: str
    lights: str

    @field_validator("noise", "crowds", "temperature", "smell", "lights")
    @classmethod
    def must_be_valid(cls, v: str) -> str:
        if v not in SENSITIVITY_MAP:
            raise ValueError(
                f"Invalid value '{v}'. Must be one of: {list(SENSITIVITY_MAP.keys())}"
            )
        return v


class PreferenceResponse(BaseModel):
    """Response body for ``GET /preferences/{username}``."""

    username: str
    noise: Optional[str] = None
    crowds: Optional[str] = None
    temperature: Optional[str] = None
    smell: Optional[str] = None
    lights: Optional[str] = None
