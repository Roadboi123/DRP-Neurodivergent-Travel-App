import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.integrations.osm_client import correct_common_typos, suggest_locations
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_correct_common_typos():
    assert correct_common_typos("st johns wood") == "st john's wood"
    assert correct_common_typos("kings cross station") == "king's cross station"
    assert correct_common_typos("queens park") == "queen's park"
    assert correct_common_typos("earls court") == "earl's court"
    assert correct_common_typos("barons court") == "baron's court"
    assert correct_common_typos("shepherds bush") == "shepherd's bush"
    assert correct_common_typos("james park") == "james's park"
    assert correct_common_typos("london") == "london"


@pytest.mark.anyio
async def test_suggest_locations_short_query():
    # Only queries of length < 2 are rejected immediately.
    # Query "a" has length 1, so it should return []
    res = await suggest_locations("a")
    assert res == []


@pytest.mark.anyio
async def test_suggest_locations_local_match():
    mock_photon_response = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [-0.1742097, 51.5353523]
                },
                "properties": {
                    "name": "St. John's Wood Underground Station",
                    "city": "London",
                    "postcode": "NW8 6DR",
                    "country": "United Kingdom"
                }
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [-0.1741901, 51.5317260]
                },
                "properties": {
                    "name": "St. John's Wood",
                    "city": "London",
                    "country": "United Kingdom"
                }
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_photon_response
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        res = await suggest_locations("st johns")
        assert len(res) >= 2
        names = [s["name"] for s in res]
        assert "St. John's Wood Underground Station" in names
        assert "St. John's Wood" in names
        
        # Check shape
        for item in res:
            assert "name" in item
            assert "display_name" in item
            assert "subtitle" in item
            assert "lat" in item
            assert "lon" in item


@pytest.mark.anyio
async def test_suggest_locations_nominatim_integration():
    mock_photon_response = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [-2.0039, 52.3848]
                },
                "properties": {
                    "name": "St Johns Wood",
                    "city": "Birmingham",
                    "country": "United Kingdom"
                }
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [-0.1742, 51.5353]
                },
                "properties": {
                    "name": "St. John's Wood Underground Station",
                    "city": "London",
                    "country": "United Kingdom"
                }
            }
        ]
    }
    
    # Mock httpx.AsyncClient.get to return mock Photon results
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_photon_response
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        
        res = await suggest_locations("bristol park")
        
        # Verify call
        mock_get.assert_called_once()
        
        # Verify London is sorted first even if order was second in response
        assert len(res) == 2
        assert "London" in res[0]["display_name"]
        assert "Birmingham" in res[1]["display_name"]


def test_suggest_locations_api_endpoint():
    # Call the API router directly using FastAPI TestClient
    with patch("app.integrations.osm_client.suggest_locations", new_callable=AsyncMock) as mock_suggest:
        mock_suggest.return_value = [
            {
                "name": "Test Suggestion",
                "display_name": "Test Suggestion, London, United Kingdom",
                "subtitle": "London, United Kingdom",
                "lat": 51.5,
                "lon": -0.1
            }
        ]
        
        resp = client.get("/routes/suggest-locations?q=test")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Suggestion"
        assert data[0]["lat"] == 51.5
        mock_suggest.assert_called_once_with("test", None, None)


@pytest.mark.anyio
async def test_suggest_locations_proximity_sorting():
    mock_photon_response = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [-0.1742097, 51.5353523]
                },
                "properties": {
                    "name": "St. John's Wood Underground Station",
                    "city": "London",
                    "postcode": "NW8 6DR",
                    "country": "United Kingdom"
                }
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [-0.5915, 51.5117]
                },
                "properties": {
                    "name": "Slough Station",
                    "city": "Slough",
                    "postcode": "SL1 1XN",
                    "country": "United Kingdom"
                }
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_photon_response
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        
        # User in Slough (lat: 51.51, lon: -0.59) should get Slough Station ranked higher
        # than St. John's Wood Underground Station (lat: 51.53, lon: -0.17).
        res = await suggest_locations("station", user_lat=51.51, user_lon=-0.59)
        names = [s["name"] for s in res]
        assert names.index("Slough Station") < names.index("St. John's Wood Underground Station")


