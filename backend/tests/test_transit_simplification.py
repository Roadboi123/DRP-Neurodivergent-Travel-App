import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.integrations.tlf_client import get_station_coords, _parse_leg, COMMON_STATIONS
from app.services.routes import get_route_suggestions

@pytest.mark.anyio
async def test_get_station_coords_cache_and_lookup():
    # Clear in-memory cache to ensure clean test
    from app.integrations import tlf_client
    tlf_client._STATION_COORDS_CACHE.clear()

    # 1. Test COMMON_STATIONS resolution
    coords = await get_station_coords(None, "paddington")
    assert coords == (51.5159, -0.1759)
    assert tlf_client._STATION_COORDS_CACHE["paddington"] == [51.5159, -0.1759]

    # 2. Test TfL StopPoint API resolution with mocked client
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.json.return_value = {"lat": 51.5007, "lon": -0.1246} # Westminster station coordinates

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_res
        coords = await get_station_coords("940GZZLUWMS", "Westminster Station")
        assert coords == (51.5007, -0.1246)
        assert tlf_client._STATION_COORDS_CACHE["940GZZLUWMS"] == [51.5007, -0.1246]
        assert tlf_client._STATION_COORDS_CACHE["westminster"] == [51.5007, -0.1246]


@pytest.mark.anyio
async def test_parse_leg_simplification_rail():
    # 1. Test when TfL lineString is present (should prioritize lineString)
    raw_leg_with_ls = {
        "mode": {"name": "elizabeth-line"},
        "departurePoint": {
            "commonName": "London Paddington",
            "naptanId": "HUBPAD",
            "lat": 51.5159,
            "lon": -0.1759
        },
        "arrivalPoint": {
            "commonName": "Bond Street",
            "naptanId": "940GZZLUBND",
            "lat": 51.5142,
            "lon": -0.1494
        },
        "path": {
            "lineString": "[[51.5159, -0.1759], [51.5150, -0.1600], [51.5142, -0.1494]]",
            "stopPoints": []
        },
        "routeOptions": [{"lineIdentifier": {"name": "Elizabeth line"}}]
    }

    parsed_with_ls = await _parse_leg(raw_leg_with_ls)
    assert parsed_with_ls["path_coords"] == [[51.5159, -0.1759], [51.5150, -0.1600], [51.5142, -0.1494]]

    # 2. Test when TfL lineString is missing (should fall back to station-to-station straight segment path)
    raw_leg_no_ls = {
        "mode": {"name": "elizabeth-line"},
        "departurePoint": {
            "commonName": "London Paddington",
            "naptanId": "HUBPAD",
            "lat": 51.5159,
            "lon": -0.1759
        },
        "arrivalPoint": {
            "commonName": "Bond Street",
            "naptanId": "940GZZLUBND",
            "lat": 51.5142,
            "lon": -0.1494
        },
        "path": {
            "lineString": None,
            "stopPoints": []
        },
        "routeOptions": [{"lineIdentifier": {"name": "Elizabeth line"}}]
    }

    parsed_no_ls = await _parse_leg(raw_leg_no_ls)
    assert parsed_no_ls["path_coords"] == [[51.5159, -0.1759], [51.5142, -0.1494]]


@pytest.mark.anyio
async def test_option_b_coordinate_slicing():
    # Test that get_route_suggestions correctly slices path_coords for short-circuited Option B journeys
    from app.integrations import tlf_client
    
    # Pre-populate cache for the intermediate stop
    tlf_client._STATION_COORDS_CACHE["acton main line"] = [51.5168, -0.2673]

    mock_tfl_journeys = [
        {
            "source": "tfl",
            "duration_mins": 30,
            "startDateTime": "2026-06-03T16:00:00",
            "arrivalDateTime": "2026-06-03T16:30:00",
            "legs": [
                {
                    "mode": "elizabeth-line",
                    "line": "Elizabeth line",
                    "duration_mins": 30,
                    "departure": "Ealing Broadway",
                    "arrival": "London Paddington",
                    "departure_naptan": "",
                    "arrival_naptan": "",
                    "departure_lat": 51.5149,
                    "departure_lon": -0.2997,
                    "arrival_lat": 51.5159,
                    "arrival_lon": -0.1759,
                    "instruction": "Take Elizabeth line",
                    "stops": ["Acton Main Line"],
                    "stop_points": [{"id": "910GACTONML", "name": "Acton Main Line"}],
                    "path_coords": [[51.5149, -0.2997], [51.5168, -0.2673], [51.5159, -0.1759]],
                    "connection_waiting_mins": 0,
                }
            ]
        }
    ]

    with patch("app.services.routes.route_resolver.resolve_source", new_callable=AsyncMock) as mock_resolve, \
         patch("app.services.routes.osm_client.geocode", new_callable=AsyncMock) as mock_geocode, \
         patch("app.services.routes.tlf_client.get_routes", new_callable=AsyncMock) as mock_tfl, \
         patch("app.services.routes.osm_client.get_walking_routes", new_callable=AsyncMock) as mock_osm, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:

        mock_resolve.return_value = {"strategy": "tfl"}
        # Geocode destination coordinates to be very close (e.g. 500m) to Acton Main Line so it triggers Option B short-circuit exit
        mock_geocode.side_effect = lambda place: (51.5149, -0.2997) if "start" in place else (51.5165, -0.2680)
        mock_tfl.return_value = mock_tfl_journeys
        mock_osm.return_value = []
        mock_temp.return_value = 18.0

        # We search from Ealing Broadway to near Acton Main Line
        routes = await get_route_suggestions("Ealing Broadway", "Near Acton Main Line")
        
        # Verify that Option B short-circuit was generated (the route will end with a walk leg from Acton Main Line)
        short_circuit_route = None
        for r in routes:
            legs = r.get("legs", [])
            if len(legs) == 2 and legs[0]["mode"] == "elizabeth-line" and legs[1]["mode"] == "walking":
                short_circuit_route = r
                break
                
        assert short_circuit_route is not None, "Short circuit route not generated"
        
        # Verify that the truncated Elizabeth line leg's path coordinates are sliced correctly:
        # [Ealing Broadway (dep), Acton Main Line (exit)] -> length of 2
        elizabeth_leg = short_circuit_route["legs"][0]
        assert elizabeth_leg["arrival"] == "Acton Main Line"
        assert elizabeth_leg["path_coords"] == [[51.5149, -0.2997], [51.5168, -0.2673]]
