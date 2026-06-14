"""Regression tests for the route suggestion service (offline path only).

These exercise the no-username branch, which never touches Supabase, so they run
deterministically in CI without a live database.
"""

import asyncio
import pytest  # type: ignore
from unittest.mock import AsyncMock, patch
from app.services.routes import get_route_suggestions

EXPECTED_KEYS = {
    "id", "name", "subName", "duration", "price",
    "noise", "crowds", "heat", "light", "smell", "description",
    "sensory_score", "match_percentage", "sensory_description", "type",
}

MOCK_TFL_JOURNEYS = [
    {
        "source": "tfl",
        "duration_mins": 50,
        "startDateTime": "2026-06-03T16:00:00",
        "arrivalDateTime": "2026-06-03T16:50:00",
        "legs": [
            {
                "mode": "bus",
                "line": "345",
                "duration_mins": 50,
                "departure": "Point A",
                "arrival": "Point B",
                "departure_naptan": "",
                "arrival_naptan": "",
                "instruction": "Take Bus 345",
                "stops": [],
                "connection_waiting_mins": 0,
            }
        ]
    },
    {
        "source": "tfl",
        "duration_mins": 30,
        "startDateTime": "2026-06-03T16:00:00",
        "arrivalDateTime": "2026-06-03T16:30:00",
        "legs": [
            {
                "mode": "tube",
                "line": "District",
                "duration_mins": 30,
                "departure": "Point A",
                "arrival": "Point B",
                "departure_naptan": "",
                "arrival_naptan": "",
                "instruction": "District Line to B",
                "stops": [],
                "connection_waiting_mins": 0,
            }
        ]
    },
    {
        "source": "tfl",
        "duration_mins": 20,
        "startDateTime": "2026-06-03T16:00:00",
        "arrivalDateTime": "2026-06-03T16:20:00",
        "legs": [
            {
                "mode": "tube",
                "line": "Central",
                "duration_mins": 20,
                "departure": "Point A",
                "arrival": "Point B",
                "departure_naptan": "",
                "arrival_naptan": "",
                "instruction": "Central Line to B",
                "stops": [],
                "connection_waiting_mins": 0,
            }
        ]
    }
]

MOCK_WALKING_JOURNEYS = [
    {
        "source": "google",
        "duration_mins": 25,
        "legs": [
            {
                "mode": "walking",
                "line": "",
                "duration_mins": 25,
                "departure": "Origin",
                "arrival": "Destination",
                "departure_naptan": "",
                "arrival_naptan": "",
                "instruction": "Walk to destination",
                "stops": [],
                "connection_waiting_mins": 0,
            }
        ]
    }
]


@pytest.fixture(autouse=True)
def mock_external_routing_apis():
    with patch("app.services.routes.route_resolver.resolve_source", new_callable=AsyncMock) as mock_resolve, \
         patch("app.services.routes.osm_client.geocode", new_callable=AsyncMock) as mock_geocode, \
         patch("app.services.routes.tlf_client.get_routes", new_callable=AsyncMock) as mock_tfl, \
         patch("app.services.routes.osm_client.get_walking_routes", new_callable=AsyncMock) as mock_osm, \
         patch("app.services.routes.tlf_client.check_live_station_disruption", new_callable=AsyncMock) as mock_disrupt, \
         patch("app.services.routes.tlf_client.check_live_station_crowding", new_callable=AsyncMock) as mock_crowd, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
         
        mock_resolve.return_value = {"strategy": "both"}
        mock_geocode.return_value = (51.5074, -0.1278)
        mock_tfl.return_value = MOCK_TFL_JOURNEYS
        mock_osm.return_value = MOCK_WALKING_JOURNEYS
        mock_disrupt.return_value = False
        mock_crowd.return_value = False
        mock_temp.return_value = 18.0
        
        yield


def test_returns_four_routes_with_expected_keys():
    routes = asyncio.run(get_route_suggestions("Current Location", "Imperial College London"))
    assert len(routes) == 4
    for route in routes:
        assert EXPECTED_KEYS.issubset(route.keys())


def test_exactly_one_best_and_one_quickest():
    routes = asyncio.run(get_route_suggestions("Paddington", "Heathrow"))
    types = [r["type"] for r in routes]
    assert types.count("best") == 1
    assert types.count("quickest") == 1


def test_default_route_is_unshifted():
    # The canonical Current Location -> Imperial input must return seed values verbatim.
    routes = asyncio.run(get_route_suggestions("Current Location", "Imperial College London"))
    bus_345 = next(r for r in routes if "Bus 345" in r["name"])
    assert bus_345["duration"] == 50
    assert bus_345["price"] == 1.75


def test_offline_match_percentage_prompts_for_username():
    routes = asyncio.run(get_route_suggestions("Current Location", "Imperial College London"))
    assert all(
        r["sensory_description"]
        == "Enter a username to view personalized sensory alignment ratings."
        for r in routes
    )


def test_custom_fare_calculations():
    # 1. Mock an outer Elizabeth Line journey
    outer_elizabeth_journey = {
        "source": "tfl",
        "duration_mins": 45,
        "startDateTime": "2026-06-03T16:00:00",
        "arrivalDateTime": "2026-06-03T16:45:00",
        "legs": [
            {
                "mode": "elizabeth-line",
                "line": "Elizabeth line",
                "duration_mins": 45,
                "departure": "Burnham (Berks) Rail Station",
                "arrival": "London Paddington",
                "departure_naptan": "",
                "arrival_naptan": "",
                "instruction": "Take Elizabeth line",
                "stops": [],
                "connection_waiting_mins": 0,
            }
        ]
    }

    # 2. Mock a non-TfL bus journey
    non_tfl_bus_journey = {
        "source": "tfl",
        "duration_mins": 20,
        "startDateTime": "2026-06-03T16:00:00",
        "arrivalDateTime": "2026-06-03T16:20:00",
        "legs": [
            {
                "mode": "bus",
                "line": "Green Line 702",
                "duration_mins": 20,
                "departure": "Slough High Street",
                "arrival": "Windsor Castle",
                "departure_naptan": "",
                "arrival_naptan": "",
                "instruction": "Take Green Line 702",
                "stops": [],
                "connection_waiting_mins": 0,
            }
        ]
    }

    with patch("app.services.routes.tlf_client.get_routes", new_callable=AsyncMock) as mock_tfl:
        mock_tfl.return_value = [outer_elizabeth_journey, non_tfl_bus_journey]
        routes = asyncio.run(get_route_suggestions("Burnham", "Windsor"))
        
        # Burnham to Paddington (outer Elizabeth) should cost 10.50
        elizabeth_route = next(r for r in routes if "Elizabeth" in r["name"])
        assert elizabeth_route["price"] == 10.50
        
        # Slough to Windsor via Green Line 702 (non-TfL bus) should cost 3.00
        bus_route = next(r for r in routes if "Green Line 702" in r["name"])
        assert bus_route["price"] == 3.00


def test_intermediate_stop_validation_prevents_teleportation():
    # Mock a bus journey from Kingston to Putney that has an intermediate stop named "Gloucester Road"
    teleport_journey = {
        "source": "tfl",
        "duration_mins": 30,
        "startDateTime": "2026-06-03T16:00:00",
        "arrivalDateTime": "2026-06-03T16:30:00",
        "legs": [
            {
                "mode": "bus",
                "line": "85",
                "duration_mins": 30,
                "departure": "Kingston",
                "arrival": "Putney Station",
                "departure_lat": 51.410,
                "departure_lon": -0.276,
                "arrival_lat": 51.461,
                "arrival_lon": -0.217,
                "departure_naptan": "",
                "arrival_naptan": "",
                "instruction": "Take Bus 85",
                "stops": ["Gloucester Road"],  # Name matches a COMMON_STATIONS entry (SW7)
                "connection_waiting_mins": 0,
                "path_coords": [[51.410, -0.276], [51.420, -0.260], [51.461, -0.217]],
            },
            {
                # Subsequent transit to trigger Option B short circuiting check
                "mode": "tube",
                "line": "District",
                "duration_mins": 10,
                "departure": "Putney Station",
                "arrival": "Earl's Court",
                "departure_lat": 51.461,
                "departure_lon": -0.217,
                "arrival_lat": 51.491,
                "arrival_lon": -0.194,
                "departure_naptan": "",
                "arrival_naptan": "",
                "instruction": "District line to Earl's Court",
                "stops": [],
                "connection_waiting_mins": 0,
            }
        ]
    }

    with patch("app.services.routes.tlf_client.get_routes", new_callable=AsyncMock) as mock_tfl, \
         patch("app.services.routes.osm_client.geocode", new_callable=AsyncMock) as mock_geocode:
        mock_tfl.return_value = [teleport_journey]
        # Target destination is South Kensington (51.4941, -0.1730)
        mock_geocode.side_effect = lambda place: (51.4941, -0.1730) if "South Kensington" in place else (51.410, -0.276)
        
        routes = asyncio.run(get_route_suggestions("Kingston", "South Kensington"))
        
        # Verify that no route was short-circuited/teleported at "Gloucester Road"
        # If it had teleported, it would have created a route where the first leg's arrival is "Gloucester Road"
        # with SW7 coordinates (51.4944, -0.1829).
        for r in routes:
            for leg in r.get("legs", []):
                if leg.get("arrival") == "Gloucester Road":
                    assert leg.get("arrival_lat") != 51.4944


def test_gwml_path_override():
    from app.integrations.tlf_client import get_gwml_path, _parse_leg
    
    # 1. Test get_gwml_path directly
    path = get_gwml_path("Reading Station", "London Paddington Station")
    assert path is not None
    assert len(path) == 16  # All 16 stations on the main line
    assert path[0] == [51.458786, -0.971849]  # Reading
    assert path[-1] == [51.516995, -0.177388]  # Paddington

    # Test westbound (reverse order)
    path_west = get_gwml_path("London Paddington", "Slough")
    assert path_west is not None
    assert len(path_west) == 11
    assert path_west[0] == [51.516995, -0.177388]  # Paddington
    assert path_west[-1] == [51.51202, -0.591924]  # Slough
    
    # 2. Test _parse_leg override
    leg = {
        "mode": {"name": "elizabeth-line"},
        "departurePoint": {"commonName": "Reading", "lat": 51.0, "lon": 0.0},
        "arrivalPoint": {"commonName": "London Paddington", "lat": 52.0, "lon": 1.0},
        "departureTime": "2026-06-03T16:00:00",
        "arrivalTime": "2026-06-03T16:40:00",
        "duration": 40,
        "instruction": {"summary": "Take Elizabeth Line"},
        "routeOptions": [{"lineIdentifier": {"name": "Elizabeth line"}}],
        "path": {"lineString": "[[-0.9, 51.4], [-0.5, 51.5]]"}
    }
    parsed = _parse_leg(leg)
    assert parsed["path_coords"] == path
    assert parsed["departure_lat"] == 51.458786
    assert parsed["arrival_lat"] == 51.516995


def test_route_suggestions_with_active_warnings_escalates_metrics():
    # 1. Mock reported warnings in supabase
    from unittest.mock import MagicMock
    from datetime import datetime, timezone
    
    mock_supabase = MagicMock()
    # Mock reported warnings returning smell (flower-outline), noise (radio-outline), and crowds (people-outline)
    # warnings close to Point A (51.5074, -0.1278)
    fresh = datetime.now(timezone.utc).isoformat()
    mock_supabase.table.return_value.select.return_value.execute.return_value.data = [
        # Smell reported (flower-outline) -> 3 distinct reports -> high confidence
        {
            "id": "w_test_smell_1",
            "warning_type": "flower-outline",
            "title": "Smell reported",
            "description": "Strong smell here",
            "lat": 51.5075,
            "lon": -0.1279,
            "created_at": fresh,
            "username": "alice1",
        },
        {
            "id": "w_test_smell_2",
            "warning_type": "flower-outline",
            "title": "Smell reported",
            "description": "Strong smell here",
            "lat": 51.5075,
            "lon": -0.1279,
            "created_at": fresh,
            "username": "alice2",
        },
        {
            "id": "w_test_smell_3",
            "warning_type": "flower-outline",
            "title": "Smell reported",
            "description": "Strong smell here",
            "lat": 51.5075,
            "lon": -0.1279,
            "created_at": fresh,
            "username": "alice3",
        },
        # Noise reported (radio-outline) -> 3 distinct reports -> high confidence
        {
            "id": "w_test_noise_1",
            "warning_type": "radio-outline",
            "title": "Loud noise reported",
            "description": "Deafening sound here",
            "lat": 51.5073,
            "lon": -0.1277,
            "created_at": fresh,
            "username": "bob1",
        },
        {
            "id": "w_test_noise_2",
            "warning_type": "radio-outline",
            "title": "Loud noise reported",
            "description": "Deafening sound here",
            "lat": 51.5073,
            "lon": -0.1277,
            "created_at": fresh,
            "username": "bob2",
        },
        {
            "id": "w_test_noise_3",
            "warning_type": "radio-outline",
            "title": "Loud noise reported",
            "description": "Deafening sound here",
            "lat": 51.5073,
            "lon": -0.1277,
            "created_at": fresh,
            "username": "bob3",
        },
        # Crowd reported (people-outline) -> 3 distinct reports -> high confidence
        {
            "id": "w_test_crowd_1",
            "warning_type": "people-outline",
            "title": "Crowds reported",
            "description": "Heavy crowding here",
            "lat": 51.5074,
            "lon": -0.1278,
            "created_at": fresh,
            "username": "charlie1",
        },
        {
            "id": "w_test_crowd_2",
            "warning_type": "people-outline",
            "title": "Crowds reported",
            "description": "Heavy crowding here",
            "lat": 51.5074,
            "lon": -0.1278,
            "created_at": fresh,
            "username": "charlie2",
        },
        {
            "id": "w_test_crowd_3",
            "warning_type": "people-outline",
            "title": "Crowds reported",
            "description": "Heavy crowding here",
            "lat": 51.5074,
            "lon": -0.1278,
            "created_at": fresh,
            "username": "charlie3",
        }
    ]
    
    # Customize the mock journey to have coordinates close to the warnings
    custom_journey = [
        {
            "source": "tfl",
            "duration_mins": 30,
            "legs": [
                {
                    "mode": "bus",
                    "line": "345",
                    "duration_mins": 30,
                    "departure": "Point A",
                    "arrival": "Point B",
                    "departure_lat": 51.5074,
                    "departure_lon": -0.1278,
                    "arrival_lat": 51.5080,
                    "arrival_lon": -0.1280,
                    "path_coords": [[51.5074, -0.1278], [51.5080, -0.1280]],
                    "departure_naptan": "",
                    "arrival_naptan": "",
                    "instruction": "Take Bus 345",
                    "stops": [],
                    "connection_waiting_mins": 0,
                }
            ]
        }
    ]
    
    with patch("app.services.routes.supabase", mock_supabase), \
         patch("app.services.routes.tlf_client.get_routes", new_callable=AsyncMock) as mock_tfl, \
         patch("app.services.routes.osm_client.get_walking_routes", new_callable=AsyncMock) as mock_osm:
        
        mock_tfl.return_value = custom_journey
        mock_osm.return_value = []
        
        routes = asyncio.run(get_route_suggestions("Point A", "Point B"))
        assert len(routes) > 0
        route = routes[0]
        # Noise, crowds, and smell should be escalated to at least 3
        assert route["noise"] >= 3
        assert route["crowds"] >= 3
        assert route["smell"] >= 3



