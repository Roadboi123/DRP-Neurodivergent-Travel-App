"""Persistence orchestration for user preset profiles.

Each user has three preset profiles (``p1``/``p2``/``p3``), each holding a full
set of sensory sensitivities, stored in the ``user_presets`` table. Exactly one
is active; saving mirrors the active preset's values into ``user_sensitivities``
so the frozen ``GET /routes/`` scoring path (which reads that table directly)
keeps working unchanged.
"""

from typing import Any, Dict, List, Optional

from app.integrations.supabase import supabase
from app.schemas.preference import SENSITIVITY_MAP, SensitivityPreferences
from app.schemas.preset import Preset, PresetsPayload, PresetsResponse
from app.services import preferences as preferences_service

# Maps a Preset's client-facing fields to their ``user_presets`` columns. The
# column names mirror ``user_sensitivities`` so the shared SENSITIVITY_MAP /
# REVERSE_SENSITIVITY_MAP encodings apply verbatim.
_FIELD_TO_COLUMN = {
    "noise": "noise_sensitivity",
    "crowds": "crowd_sensitivity",
    "temperature": "heat_sensitivity",
    "smell": "smell_sensitivity",
    "lights": "light_sensitivity",
}


class PresetPersistenceError(Exception):
    """Raised when Supabase returns an unexpected/empty result while persisting."""


def _preset_to_row(username: str, preset: Preset, is_active: bool) -> Dict[str, Any]:
    return {
        "username": username,
        "preset_id": preset.id,
        "name": preset.name,
        "is_active": is_active,
        "noise_sensitivity": SENSITIVITY_MAP[preset.noise],
        "crowd_sensitivity": SENSITIVITY_MAP[preset.crowds],
        "heat_sensitivity": SENSITIVITY_MAP[preset.temperature],
        "smell_sensitivity": SENSITIVITY_MAP[preset.smell],
        "light_sensitivity": SENSITIVITY_MAP[preset.lights],
    }


def _row_to_preset(row: Dict[str, Any]) -> Preset:
    rev = preferences_service.REVERSE_SENSITIVITY_MAP
    # Build a plain dict and let Pydantic validate the literals at runtime
    # (model_validate accepts Any, so the stored labels are checked here).
    return Preset.model_validate({
        "id": row.get("preset_id"),
        "name": row.get("name") or row.get("preset_id"),
        "noise": rev.get(int(row.get("noise_sensitivity") or 2)),
        "crowds": rev.get(int(row.get("crowd_sensitivity") or 2)),
        "temperature": rev.get(int(row.get("heat_sensitivity") or 2)),
        "smell": rev.get(int(row.get("smell_sensitivity") or 2)),
        "lights": rev.get(int(row.get("light_sensitivity") or 2)),
    })


def save_presets(payload: PresetsPayload) -> PresetsResponse:
    """Replace a user's preset set and mirror the active one for route scoring."""
    rows = [
        _preset_to_row(payload.username, preset, preset.id == payload.active_id)
        for preset in payload.presets
    ]

    result = supabase.table("user_presets").upsert(rows).execute()

    if not result.data or not isinstance(result.data, list) or len(result.data) == 0:
        raise PresetPersistenceError("Failed to save presets")

    # Mirror the active preset into user_sensitivities so GET /routes/ scoring
    # reads the same values it always has (reuses the existing save path).
    active = next((p for p in payload.presets if p.id == payload.active_id), None)
    if active is not None:
        preferences_service.save_preferences(
            SensitivityPreferences(
                username=payload.username,
                noise=active.noise,
                crowds=active.crowds,
                temperature=active.temperature,
                smell=active.smell,
                lights=active.lights,
            )
        )

    return PresetsResponse(
        username=payload.username,
        active_id=payload.active_id,
        presets=payload.presets,
    )


def get_presets(username: str) -> Optional[PresetsResponse]:
    """Return a user's presets mapped to client labels, or ``None`` if absent."""
    result = supabase.table("user_presets") \
        .select("*") \
        .eq("username", username) \
        .execute()

    if not result.data or not isinstance(result.data, list) or len(result.data) == 0:
        return None

    rows: List[Dict[str, Any]] = [r for r in result.data if isinstance(r, dict)]
    if not rows:
        raise PresetPersistenceError("Unexpected response format")

    presets = [_row_to_preset(r) for r in rows]
    presets.sort(key=lambda p: p.id)

    active_id = next((r.get("preset_id") for r in rows if r.get("is_active")), None)
    if active_id is None:
        active_id = presets[0].id

    return PresetsResponse(username=username, active_id=active_id, presets=presets)
