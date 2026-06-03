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
