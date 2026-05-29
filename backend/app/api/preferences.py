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
 
    if not result.data or not isinstance(result.data, list) or len(result.data) == 0:
        raise HTTPException(status_code=500, detail="Failed to save preferences")
 
    saved_row = result.data[0]
    if not isinstance(saved_row, dict):
        raise HTTPException(status_code=500, detail="Unexpected response format")

    return {
        "username":      saved_row.get("username"),
        "message": "Preferences saved successfully"
    }
 
 
@pref_router.get("/{username}")
def get_preferences(username: str):
    result = supabase.table("user_sensitivities") \
        .select("*") \
        .eq("username", username) \
        .execute()
 
    if not result.data or not isinstance(result.data, list) or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Preferences not found")
 
    db_data = result.data[0]
    if not isinstance(db_data, dict):
        raise HTTPException(status_code=500, detail="Unexpected response format")
    
    # Map database columns back to the structure the React Native screen expects
    return {
        "username":    db_data.get("username"),
        "noise":       REVERSE_SENSITIVITY_MAP.get(int(db_data.get("noise_sensitivity") or 2)),
        "crowds":      REVERSE_SENSITIVITY_MAP.get(int(db_data.get("crowd_sensitivity") or 2)),
        "temperature": REVERSE_SENSITIVITY_MAP.get(int(db_data.get("heat_sensitivity") or 2)),
        "smell":       REVERSE_SENSITIVITY_MAP.get(int(db_data.get("smell_sensitivity") or 2)),
        "lights":      REVERSE_SENSITIVITY_MAP.get(int(db_data.get("light_sensitivity") or 2)),
    }