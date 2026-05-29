from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
from app.integrations.supabase import supabase
 
pref_router = APIRouter(prefix="/preferences", tags=["preferences"])

 
SENSITIVITY_MAP = {
    "little":     1,
    "manageable": 2,
    "dontcare":   3,
}

REVERSE_SENSITIVITY_MAP = {
    1:"little",
    2:"manageable",
    3:"dontcare"
}

 
 
class SensitivityPreferences(BaseModel):
    username:    str
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
    result = supabase.table("user_sensitivities").upsert({
        "username": prefs.username,
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
 
 
@pref_router.get("/{username}")
def get_preferences(username: str):
    result = supabase.table("user_sensitivities") \
        .select("*") \
        .eq("username", username) \
        .execute()
 
    if not result.data:
        raise HTTPException(status_code=404, detail="Preferences not found")
 
    db_data = result.data[0]
    
    # Map database columns back to the structure the React Native screen expects
    return {
        "username":    db_data["username"],
        "noise":       REVERSE_SENSITIVITY_MAP.get(db_data["noise_sensitivity"]),
        "crowds":      REVERSE_SENSITIVITY_MAP.get(db_data["crowd_sensitivity"]),
        "temperature": REVERSE_SENSITIVITY_MAP.get(db_data["heat_sensitivity"]),
        "smell":       REVERSE_SENSITIVITY_MAP.get(db_data["smell_sensitivity"]),
        "lights":      REVERSE_SENSITIVITY_MAP.get(db_data["light_sensitivity"]),
    }