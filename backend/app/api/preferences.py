from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from app.integrations.supabase import supabase
import os
 
pref_router = APIRouter(prefix="/preferences", tags=["preferences"])

 
SENSITIVITY_MAP = {
    "little":     1,
    "manageable": 2,
    "dontcare":   3,
}
 
 
class SensitivityPreferences(BaseModel):
    noise:       str
    crowds:      str
    temperature: str
    smell:       str
    lights:      str
 
    @field_validator("noise", "crowds", "temperature", "smell", "lights")
    @classmethod
    def must_be_valid(cls, v: str) -> str:
        if v not in SENSITIVITY_MAP:
            raise ValueError(
                f"Invalid value '{v}'. Must be one of: {list(SENSITIVITY_MAP.keys())}"
            )
        return v
 
 
@pref_router.post("/", status_code=201)
def save_preferences(prefs: SensitivityPreferences):
    """Save sensory preferences from the user preferences screen."""
    result = supabase.table("user_sensitivities").insert({
        "username":prefs.username
        "noise_sensitivity":  SENSITIVITY_MAP[prefs.noise],
        "crowd_sensitivity":  SENSITIVITY_MAP[prefs.crowds],
        "heat_sensitivity":   SENSITIVITY_MAP[prefs.temperature],
        "smell_sensitivity":  SENSITIVITY_MAP[prefs.smell],
        "light_sensitivity":  SENSITIVITY_MAP[prefs.lights],
    }).execute()
 
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save preferences")
 
    return {
        "username":      result.data[0]["username"],
        "message": "Preferences saved successfully"
    }
 
 
@pref_router.get("/{preference_id}")
def get_preferences(preference_id: str):
    """Retrieve a saved preference set by UUID."""
    result = supabase.table("user_sensitivities") \
        .select("*") \
        .eq("id", preference_id) \
        .execute()
 
    if not result.data:
        raise HTTPException(status_code=404, detail="Preferences not found")
 
    return result.data[0]