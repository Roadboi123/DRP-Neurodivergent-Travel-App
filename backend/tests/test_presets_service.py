"""Unit tests for the preset persistence service (Supabase mocked).

These never touch a live database: the ``supabase`` client used by the service
is patched, so they run deterministically in CI.
"""

from unittest.mock import MagicMock, patch

import pytest  # type: ignore

from app.schemas.preference import SensitivityLevel
from app.schemas.preset import Preset, PresetId, PresetsPayload
from app.services import presets as presets_service


def _preset(pid: PresetId, level: SensitivityLevel) -> Preset:
    return Preset(
        id=pid,
        name=f"Preset {pid[-1]}",
        noise=level,
        crowds=level,
        temperature=level,
        smell=level,
        lights=level,
    )


def _payload(active_id: PresetId = "p3") -> PresetsPayload:
    return PresetsPayload(
        username="meg",
        active_id=active_id,
        presets=[_preset("p1", "little"), _preset("p2", "medium"), _preset("p3", "high")],
    )


def test_save_presets_upserts_three_rows_with_one_active():
    with patch("app.services.presets.supabase") as mock_supabase, \
         patch("app.services.presets.preferences_service.save_preferences"):
        table = mock_supabase.table.return_value
        table.upsert.return_value.execute.return_value = MagicMock(
            data=[{"username": "meg", "preset_id": "p1"}]
        )

        result = presets_service.save_presets(_payload(active_id="p3"))

        mock_supabase.table.assert_called_with("user_presets")
        rows = table.upsert.call_args.args[0]
        assert [r["preset_id"] for r in rows] == ["p1", "p2", "p3"]
        # Exactly one row flagged active — the one matching active_id.
        assert [r["is_active"] for r in rows] == [False, False, True]
        # Encodings go through SENSITIVITY_MAP (little=1, medium=2, high=3).
        assert rows[0]["noise_sensitivity"] == 1
        assert rows[1]["crowd_sensitivity"] == 2
        assert rows[2]["heat_sensitivity"] == 3
        assert result.active_id == "p3"


def test_save_presets_mirrors_active_preset_to_user_sensitivities():
    with patch("app.services.presets.supabase") as mock_supabase, \
         patch("app.services.presets.preferences_service.save_preferences") as mock_mirror:
        mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock(
            data=[{"username": "meg"}]
        )

        presets_service.save_presets(_payload(active_id="p1"))

        mock_mirror.assert_called_once()
        mirrored = mock_mirror.call_args.args[0]
        # The active preset (p1 = all "little") is what gets mirrored.
        assert mirrored.username == "meg"
        assert mirrored.noise == "little"
        assert mirrored.lights == "little"


def test_save_presets_raises_on_empty_result():
    with patch("app.services.presets.supabase") as mock_supabase, \
         patch("app.services.presets.preferences_service.save_preferences"):
        mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[])

        with pytest.raises(presets_service.PresetPersistenceError):
            presets_service.save_presets(_payload())


def test_get_presets_maps_rows_and_derives_active():
    rows = [
        {
            "username": "meg", "preset_id": "p2", "name": "Preset 2", "is_active": True,
            "noise_sensitivity": 2, "crowd_sensitivity": 2, "heat_sensitivity": 2,
            "smell_sensitivity": 2, "light_sensitivity": 2,
        },
        {
            "username": "meg", "preset_id": "p1", "name": "Preset 1", "is_active": False,
            "noise_sensitivity": 1, "crowd_sensitivity": 1, "heat_sensitivity": 1,
            "smell_sensitivity": 1, "light_sensitivity": 1,
        },
    ]
    with patch("app.services.presets.supabase") as mock_supabase:
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=rows
        )

        result = presets_service.get_presets("meg")

        assert result is not None
        assert result.active_id == "p2"
        # Sorted by preset_id regardless of row order.
        assert [p.id for p in result.presets] == ["p1", "p2"]
        p1 = next(p for p in result.presets if p.id == "p1")
        assert p1.noise == "little"
        assert p1.temperature == "little"


def test_get_presets_returns_none_when_absent():
    with patch("app.services.presets.supabase") as mock_supabase:
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )

        assert presets_service.get_presets("nobody") is None
