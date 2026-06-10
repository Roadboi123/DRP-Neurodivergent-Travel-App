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


def _supabase_returning(rows):
    """A supabase mock whose table().select().eq().execute().data == rows."""
    mock_supabase = MagicMock()
    chain = mock_supabase.table.return_value.select.return_value.eq.return_value
    chain.execute.return_value = MagicMock(data=rows)
    return mock_supabase


# A warning ~10m away (well inside DUPLICATE_RADIUS_M of 75m).
_NEARBY = (51.5074, -0.12792)
_REF = (51.5074, -0.1278)


def test_duplicate_report_blocks_same_type_nearby_and_fresh():
    fresh = datetime.now(timezone.utc).isoformat()
    rows = [{"warning_type": "sound", "lat": _NEARBY[0], "lon": _NEARBY[1], "created_at": fresh}]
    with patch("app.services.routes.supabase", _supabase_returning(rows)):
        assert is_duplicate_report("sound", _REF[0], _REF[1]) is True


def test_duplicate_report_allows_far_away():
    fresh = datetime.now(timezone.utc).isoformat()
    rows = [{"warning_type": "sound", "lat": 51.6000, "lon": -0.2000, "created_at": fresh}]
    with patch("app.services.routes.supabase", _supabase_returning(rows)):
        assert is_duplicate_report("sound", _REF[0], _REF[1]) is False


def test_duplicate_report_ignores_expired_nearby():
    stale = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    rows = [{"warning_type": "sound", "lat": _NEARBY[0], "lon": _NEARBY[1], "created_at": stale}]
    with patch("app.services.routes.supabase", _supabase_returning(rows)):
        assert is_duplicate_report("sound", _REF[0], _REF[1]) is False


def test_duplicate_report_empty_db_is_not_duplicate():
    with patch("app.services.routes.supabase", _supabase_returning([])):
        assert is_duplicate_report("sound", _REF[0], _REF[1]) is False
