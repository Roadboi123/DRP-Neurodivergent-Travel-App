import asyncio
from unittest.mock import AsyncMock, patch
from app.services.routes import get_user_warnings

def test_no_station_works_warnings_when_clean():
    # If get_live_station_works returns empty, there should be no station works warnings.
    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        
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
            {"line": "Bakerloo", "severity": "medium", "description": "delays", "status_desc": "Delayed"},
            {"line": "Central", "severity": "medium", "description": "delays", "status_desc": "Delayed"},
            {"line": "Circle", "severity": "medium", "description": "delays", "status_desc": "Delayed"},
            {"line": "District", "severity": "medium", "description": "delays", "status_desc": "Delayed"},
        ]
        mock_temp.return_value = 18.0
        
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        crowd_warnings = [w for w in warnings if w["title"] == "Station Crowding"]
        assert len(crowd_warnings) == 1
        assert crowd_warnings[0]["desc"] == "Multiple line delays are causing platform crowding."
