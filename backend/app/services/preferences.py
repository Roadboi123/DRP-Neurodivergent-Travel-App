"""Persistence orchestration for user sensory preferences."""

from typing import Any, Dict, Optional

from app.integrations.supabase import supabase
from app.schemas.preference import SENSITIVITY_MAP, SensitivityPreferences

# Inverse of SENSITIVITY_MAP: stored integers back to client-facing labels.
REVERSE_SENSITIVITY_MAP = {
    1: "little",
    2: "manageable",
    3: "dontcare",
}


class PreferencePersistenceError(Exception):
    """Raised when Supabase returns an unexpected/empty result while persisting."""


def save_preferences(prefs: SensitivityPreferences) -> Optional[str]:
    """Upsert a user's sensitivities and return the stored username."""
    result = supabase.table("user_sensitivities").upsert({
        "username": prefs.username,
        "noise_sensitivity": SENSITIVITY_MAP[prefs.noise],
        "crowd_sensitivity": SENSITIVITY_MAP[prefs.crowds],
        "heat_sensitivity": SENSITIVITY_MAP[prefs.temperature],
        "smell_sensitivity": SENSITIVITY_MAP[prefs.smell],
        "light_sensitivity": SENSITIVITY_MAP[prefs.lights],
    }).execute()

    if not result.data or not isinstance(result.data, list) or len(result.data) == 0:
        raise PreferencePersistenceError("Failed to save preferences")

    saved_row = result.data[0]
    if not isinstance(saved_row, dict):
        raise PreferencePersistenceError("Unexpected response format")

    return saved_row.get("username")


def get_preferences(username: str) -> Optional[Dict[str, Any]]:
    """Return a user's preferences mapped to client labels, or ``None`` if absent."""
    result = supabase.table("user_sensitivities") \
        .select("*") \
        .eq("username", username) \
        .execute()

    if not result.data or not isinstance(result.data, list) or len(result.data) == 0:
        return None

    db_data = result.data[0]
    if not isinstance(db_data, dict):
        raise PreferencePersistenceError("Unexpected response format")

    # Map database columns back to the structure the React Native screen expects
    return {
        "username": db_data.get("username"),
        "noise": REVERSE_SENSITIVITY_MAP.get(int(db_data.get("noise_sensitivity") or 2)),
        "crowds": REVERSE_SENSITIVITY_MAP.get(int(db_data.get("crowd_sensitivity") or 2)),
        "temperature": REVERSE_SENSITIVITY_MAP.get(int(db_data.get("heat_sensitivity") or 2)),
        "smell": REVERSE_SENSITIVITY_MAP.get(int(db_data.get("smell_sensitivity") or 2)),
        "lights": REVERSE_SENSITIVITY_MAP.get(int(db_data.get("light_sensitivity") or 2)),
    }
