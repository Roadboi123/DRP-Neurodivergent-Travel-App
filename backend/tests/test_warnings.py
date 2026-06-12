import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
from app.services.routes import get_user_warnings, is_duplicate_report

@pytest.fixture(autouse=True)
def mock_supabase_client():
    with patch("app.services.routes.supabase") as mock_supabase:
        mock_execute = MagicMock()
        mock_execute.execute.return_value = MagicMock(data=[])
        
        mock_table = MagicMock()
        mock_table.select.return_value = mock_execute
        mock_table.select.return_value.eq.return_value = mock_execute
        
        mock_supabase.table.return_value = mock_table
        yield mock_supabase


def test_no_station_works_warnings_when_clean():
    # If get_live_station_works returns empty, there should be no station works warnings.
    # Also mock supabase to avoid real DB calls for user-reported warnings.
    from unittest.mock import MagicMock
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.execute.return_value.data = []
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp, \
         patch("app.services.routes.supabase", mock_supabase):

        mock_works.return_value = []
        mock_disruptions.return_value = []
        mock_temp.return_value = 18.0

        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        assert len(warnings) == 0



def test_station_works_warnings_single_station():
    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        
        mock_works.return_value = ["Wembley Park"]
        mock_disruptions.return_value = []
        mock_temp.return_value = 18.0
        
        # When generic is True (or noise sensitivity >= 3), we should get the warning
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        station_warnings = [w for w in warnings if w["title"] == "Drilling & Works"]
        assert len(station_warnings) == 1
        assert station_warnings[0]["desc"] == "Drilling works reported at Wembley Park station."
        assert station_warnings[0]["icon"] == "volume-high"

def test_station_works_warnings_multiple_stations():
    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        
        mock_works.return_value = ["Wembley Park", "Bank"]
        mock_disruptions.return_value = []
        mock_temp.return_value = 18.0
        
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        station_warnings = [w for w in warnings if w["title"] == "Drilling & Works"]
        assert len(station_warnings) == 1
        assert station_warnings[0]["desc"] == "Drilling works reported at Wembley Park and Bank stations."

def test_station_works_warnings_many_stations():
    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        
        mock_works.return_value = ["Wembley Park", "Bank", "Waterloo", "Victoria"]
        mock_disruptions.return_value = []
        mock_temp.return_value = 18.0
        
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        station_warnings = [w for w in warnings if w["title"] == "Drilling & Works"]
        assert len(station_warnings) == 1
        assert station_warnings[0]["desc"] == "Drilling works reported at Wembley Park, Bank, and 2 other stations."


def test_multiple_line_delays_collapse():
    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        
        mock_works.return_value = []
        mock_disruptions.return_value = [
            {"line": "Bakerloo", "severity": "medium", "description": "delays", "status_desc": "Minor Delays"},
            {"line": "Central", "severity": "medium", "description": "delays", "status_desc": "Minor Delays"},
            {"line": "Circle", "severity": "medium", "description": "delays", "status_desc": "Minor Delays"},
            {"line": "District", "severity": "medium", "description": "delays", "status_desc": "Minor Delays"},
        ]
        mock_temp.return_value = 18.0
        
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        delay_warnings = [w for w in warnings if w["title"] == "Line Delays"]
        assert len(delay_warnings) == 1
        assert delay_warnings[0]["desc"] == "Multiple lines are experiencing delays."

def test_multiple_line_delays_sensory():
    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        
        mock_works.return_value = []
        mock_disruptions.return_value = [
            {"line": "Bakerloo", "severity": "medium", "description": "delays", "status_desc": "Minor Delays"},
            {"line": "Central", "severity": "medium", "description": "delays", "status_desc": "Minor Delays"},
            {"line": "Circle", "severity": "medium", "description": "delays", "status_desc": "Minor Delays"},
            {"line": "District", "severity": "medium", "description": "delays", "status_desc": "Minor Delays"},
        ]
        mock_temp.return_value = 18.0
        
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=False))
        crowd_warnings = [w for w in warnings if w["title"] == "Station Crowding"]
        assert len(crowd_warnings) == 1
        assert crowd_warnings[0]["desc"] == "Multiple line delays are causing platform crowding."

def test_line_suspensions_and_closures():
    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        
        mock_works.return_value = []
        mock_disruptions.return_value = [
            {"line": "Central", "severity": "high", "description": "suspended", "status_desc": "Part Suspended"},
            {"line": "Piccadilly", "severity": "high", "description": "closed", "status_desc": "Part Closed"},
        ]
        mock_temp.return_value = 18.0
        
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        susp_warnings = [w for w in warnings if w["title"] == "Line Suspension"]
        assert len(susp_warnings) == 1
        assert susp_warnings[0]["desc"] == "Central Line is suspended."
        
        closure_warnings = [w for w in warnings if w["title"] == "Line Closure"]
        assert len(closure_warnings) == 1
        assert closure_warnings[0]["desc"] == "Piccadilly Line has closures."


def test_many_line_suspensions_list_all():
    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        
        mock_works.return_value = []
        mock_disruptions.return_value = [
            {"line": "Bakerloo", "severity": "high", "description": "suspended", "status_desc": "Suspended"},
            {"line": "Central", "severity": "high", "description": "suspended", "status_desc": "Suspended"},
            {"line": "District", "severity": "high", "description": "suspended", "status_desc": "Suspended"},
            {"line": "Jubilee", "severity": "high", "description": "suspended", "status_desc": "Suspended"},
        ]
        mock_temp.return_value = 18.0
        
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        susp_warnings = [w for w in warnings if w["title"] == "Line Suspensions"]
        assert len(susp_warnings) == 1
        assert susp_warnings[0]["desc"] == "Bakerloo, Central, District, and Jubilee lines are suspended."


class _FakeQuery:
    """Minimal PostgREST-ish query that applies eq()/in_() filters in execute(),
    so tests exercise the real per-user / per-type filtering the code relies on."""

    def __init__(self, rows):
        self._rows = list(rows)
        self._filters: list = []

    def select(self, *args, **kwargs):
        return self

    def eq(self, col, val):
        self._filters.append((col, "eq", val))
        return self

    def in_(self, col, vals):
        self._filters.append((col, "in", set(vals)))
        return self

    def execute(self):
        rows = self._rows
        for col, op, val in self._filters:
            if op == "in":
                rows = [r for r in rows if r.get(col) in val]
            else:
                rows = [r for r in rows if r.get(col) == val]
        return MagicMock(data=list(rows))


class _FakeSupabase:
    """Routes table(name) to that table's rows; queries filter them faithfully."""

    def __init__(self, tables):
        self._tables = tables

    def table(self, name):
        return _FakeQuery(self._tables.get(name, []))


def _supabase_returning(rows):
    """A supabase fake whose reported_warnings table holds ``rows``."""
    return _FakeSupabase({"reported_warnings": rows})


# A warning ~10m away (well inside DUPLICATE_RADIUS_M of 75m).
_NEARBY = (51.5074, -0.12792)
_REF = (51.5074, -0.1278)


def test_duplicate_report_blocks_same_user_nearby_and_fresh():
    fresh = datetime.now(timezone.utc).isoformat()
    rows = [{"warning_type": "sound", "username": "alice", "lat": _NEARBY[0], "lon": _NEARBY[1], "created_at": fresh}]
    with patch("app.services.routes.supabase", _supabase_returning(rows)):
        assert is_duplicate_report("sound", _REF[0], _REF[1], "alice") is True


def test_duplicate_report_allows_different_user_same_spot():
    # Aggregation needs distinct users to stack, so a *different* user reporting
    # the same fresh nearby spot must be allowed.
    fresh = datetime.now(timezone.utc).isoformat()
    rows = [{"warning_type": "sound", "username": "alice", "lat": _NEARBY[0], "lon": _NEARBY[1], "created_at": fresh}]
    with patch("app.services.routes.supabase", _supabase_returning(rows)):
        assert is_duplicate_report("sound", _REF[0], _REF[1], "bob") is False


def test_duplicate_report_allows_far_away():
    fresh = datetime.now(timezone.utc).isoformat()
    rows = [{"warning_type": "sound", "username": "alice", "lat": 51.6000, "lon": -0.2000, "created_at": fresh}]
    with patch("app.services.routes.supabase", _supabase_returning(rows)):
        assert is_duplicate_report("sound", _REF[0], _REF[1], "alice") is False


def test_duplicate_report_ignores_expired_nearby():
    stale = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    rows = [{"warning_type": "sound", "username": "alice", "lat": _NEARBY[0], "lon": _NEARBY[1], "created_at": stale}]
    with patch("app.services.routes.supabase", _supabase_returning(rows)):
        assert is_duplicate_report("sound", _REF[0], _REF[1], "alice") is False


def test_duplicate_report_empty_db_is_not_duplicate():
    with patch("app.services.routes.supabase", _supabase_returning([])):
        assert is_duplicate_report("sound", _REF[0], _REF[1], "alice") is False


def test_duplicate_report_anonymous_never_blocked():
    fresh = datetime.now(timezone.utc).isoformat()
    rows = [{"warning_type": "sound", "username": "", "lat": _NEARBY[0], "lon": _NEARBY[1], "created_at": fresh}]
    with patch("app.services.routes.supabase", _supabase_returning(rows)):
        assert is_duplicate_report("sound", _REF[0], _REF[1], "") is False


# ---------------------------------------------------------------------------
# Aggregation of user-reported warnings (read path: get_user_warnings)
# ---------------------------------------------------------------------------

# heat (thermometer-*) maps to heat_sensitivity in the weighting step.
_HEAT = "thermometer-outline"


def _report_row(username, coords, *, wtype=_HEAT, minutes_ago=0, rid=None):
    ts = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()
    return {
        "id": rid or f"w_{username}_{coords[0]}_{coords[1]}",
        "username": username,
        "warning_type": wtype,
        "title": "Heat reported",
        "description": "Heat flagged here by a traveller.",
        "lat": coords[0],
        "lon": coords[1],
        "created_at": ts,
    }


def _run_warnings(reported_rows, sensitivity_rows=None, username="viewer"):
    """Run get_user_warnings (generic) with TfL/weather stubbed out, so only the
    user-reported aggregation contributes to the result."""
    fake = _FakeSupabase({
        "reported_warnings": reported_rows,
        "user_sensitivities": sensitivity_rows or [],
    })
    with patch("app.services.routes.supabase", fake), \
         patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        mock_works.return_value = []
        mock_disruptions.return_value = []
        mock_temp.return_value = 18.0
        all_warnings = asyncio.run(get_user_warnings(username=username, generic=True))
    # Only the geolocated user reports (those carrying a report_count).
    return [w for w in all_warnings if w.get("report_count") is not None]


def test_aggregate_distinct_users_raise_confidence():
    # Two different users, same type, ~10m apart -> one cluster, 2 reports, bumped.
    rows = [
        _report_row("alice", _REF),
        _report_row("bob", _NEARBY),
    ]
    out = _run_warnings(rows)
    assert len(out) == 1
    assert out[0]["report_count"] == 2
    assert out[0]["confidence_score"] == 2.0  # 1.0 + 1.0 default trust
    assert out[0]["severity"] == "medium"  # >= 1.5
    assert "[Confidence" not in out[0]["desc"]  # prefix is gone


def test_single_report_is_low_confidence():
    out = _run_warnings([_report_row("alice", _REF)])
    assert len(out) == 1
    assert out[0]["report_count"] == 1
    assert out[0]["severity"] == "info"


def test_same_user_twice_counts_once():
    rows = [
        _report_row("alice", _REF, rid="w_a1", minutes_ago=1),
        _report_row("alice", _NEARBY, rid="w_a2", minutes_ago=0),
    ]
    out = _run_warnings(rows)
    assert len(out) == 1
    assert out[0]["report_count"] == 1
    assert out[0]["confidence_score"] == 1.0


def test_sensitive_reporter_is_down_weighted():
    # A very-high (4) sensitivity reporter is trusted far less than a low (1) one.
    very_sensitive = _run_warnings(
        [_report_row("alice", _REF)],
        sensitivity_rows=[{"username": "alice", "heat_sensitivity": 4}],
    )
    low_sensitive = _run_warnings(
        [_report_row("bob", _REF)],
        sensitivity_rows=[{"username": "bob", "heat_sensitivity": 1}],
    )
    assert very_sensitive[0]["confidence_score"] == 0.25
    assert low_sensitive[0]["confidence_score"] == 2.0
    assert very_sensitive[0]["severity"] == "info"
    assert low_sensitive[0]["severity"] == "medium"


def test_expired_report_excluded_from_aggregation():
    out = _run_warnings([_report_row("alice", _REF, minutes_ago=30)])
    assert out == []
