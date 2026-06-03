"""Regression tests for the route suggestion service (offline path only).

These exercise the no-username branch, which never touches Supabase, so they run
deterministically in CI without a live database.
"""

from app.services.routes import get_route_suggestions

EXPECTED_KEYS = {
    "id", "name", "subName", "duration", "price",
    "noise", "crowds", "heat", "light", "smell", "description",
    "sensory_score", "match_percentage", "sensory_description", "type",
}


def test_returns_four_routes_with_expected_keys():
    routes = get_route_suggestions("Current Location", "Imperial College London")
    assert len(routes) == 4
    for route in routes:
        assert EXPECTED_KEYS.issubset(route.keys())


def test_exactly_one_best_and_one_quickest():
    routes = get_route_suggestions("Paddington", "Heathrow")
    types = [r["type"] for r in routes]
    assert types.count("best") == 1
    assert types.count("quickest") == 1


def test_default_route_is_unshifted():
    # The canonical Current Location -> Imperial input must return seed values verbatim.
    routes = get_route_suggestions("Current Location", "Imperial College London")
    bus_345 = next(r for r in routes if r["id"] == "r1")
    assert bus_345["duration"] == 50
    assert bus_345["price"] == 1.75


def test_offline_match_percentage_prompts_for_username():
    routes = get_route_suggestions("Current Location", "Imperial College London")
    assert all(
        r["sensory_description"]
        == "Enter a username to view personalized sensory alignment ratings."
        for r in routes
    )
