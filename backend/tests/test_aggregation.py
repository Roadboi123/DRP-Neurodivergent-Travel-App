import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
from app.services.routes import get_user_warnings

@pytest.fixture
def mock_external_apis():
    with patch("app.services.routes.tlf_client.get_live_station_works", new_callable=AsyncMock) as mock_works, \
         patch("app.services.routes.tlf_client.get_live_line_disruptions", new_callable=AsyncMock) as mock_disruptions, \
         patch("app.services.routes.get_current_london_temp", new_callable=AsyncMock) as mock_temp:
        mock_works.return_value = []
        mock_disruptions.return_value = []
        mock_temp.return_value = 18.0
        yield


def test_warning_weighting_and_severity_escalation(mock_external_apis):
    # Mock database to return reports from different users
    # User A (high noise sensitivity = 3) -> weight 0.5
    # User B (low noise sensitivity = 1) -> weight 2.0
    
    mock_supabase = MagicMock()
    now_utc = datetime.now(timezone.utc)
    t1 = (now_utc - timedelta(minutes=5)).isoformat()
    t2 = (now_utc - timedelta(minutes=1)).isoformat()
    
    # Mock reported warnings table select
    mock_warnings_execute = MagicMock()
    mock_warnings_execute.execute.return_value = MagicMock(data=[
        {
            "id": "w1",
            "username": "user_high",
            "warning_type": "radio-outline",
            "title": "Noise reported",
            "description": "Loud drilling.",
            "lat": 51.5074,
            "lon": -0.1278,
            "created_at": t1
        },
        {
            "id": "w2",
            "username": "user_low",
            "warning_type": "radio-outline",
            "title": "Noise reported",
            "description": "Extremely loud drilling.",
            "lat": 51.5075,  # within 150m of w1
            "lon": -0.1279,
            "created_at": t2  # more recent than w1
        }
    ])
    
    # Mock user sensitivities table select
    mock_sens_execute = MagicMock()
    mock_sens_execute.execute.return_value = MagicMock(data=[
        {"username": "user_high", "noise_sensitivity": 3},
        {"username": "user_low", "noise_sensitivity": 1}
    ])
    
    def mock_table_routing(table_name):
        if table_name == "reported_warnings":
            mock_table = MagicMock()
            mock_table.select.return_value = mock_warnings_execute
            return mock_table
        elif table_name == "user_sensitivities":
            mock_table = MagicMock()
            mock_table.select.return_value.in_.return_value = mock_sens_execute
            return mock_table
        return MagicMock()

    mock_supabase.table.side_effect = mock_table_routing

    with patch("app.services.routes.supabase", mock_supabase):
        # Retrieve warnings
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        
        # We expect 1 aggregated warning because w1 and w2 are within 150m and same type
        assert len(warnings) == 1
        agg_warning = warnings[0]
        
        # Combined weight = user_high (0.5) + user_low (2.0) = 2.5
        assert agg_warning["confidence_score"] == 2.5
        assert agg_warning["report_count"] == 2
        
        # Weight 2.5 is >= 1.5 and < 3.0, so severity is medium
        assert agg_warning["severity"] == "medium"
        
        # Representative should be the latest (w2)
        assert agg_warning["id"] == "w2"
        assert agg_warning["title"] == "Noise reported"
        assert "Extremely loud drilling" in agg_warning["desc"]

        # Confidence now travels via severity/report_count/confidence_score, not
        # an inline text prefix — the description stays clean.
        assert "[Confidence" not in agg_warning["desc"]


def test_warning_clustering_proximity(mock_external_apis):
    # Setup warnings:
    # w1: sound, lat: 51.5074, lon: -0.1278
    # w2: sound, lat: 51.5075, lon: -0.1279 (approx 15m away, should cluster with w1)
    # w3: sound, lat: 51.5300, lon: -0.1400 (approx 2.7km away, should NOT cluster)
    # w4: crowds, lat: 51.5074, lon: -0.1278 (same location as w1, different type, should NOT cluster)
    
    mock_supabase = MagicMock()
    now_utc = datetime.now(timezone.utc)
    t1 = (now_utc - timedelta(minutes=5)).isoformat()
    t2 = (now_utc - timedelta(minutes=4)).isoformat()
    t3 = (now_utc - timedelta(minutes=3)).isoformat()
    t4 = (now_utc - timedelta(minutes=2)).isoformat()
    
    mock_warnings_execute = MagicMock()
    mock_warnings_execute.execute.return_value = MagicMock(data=[
        {
            "id": "w1",
            "username": "user_a",
            "warning_type": "radio-outline",
            "title": "Noise",
            "description": "Loud drilling.",
            "lat": 51.5074,
            "lon": -0.1278,
            "created_at": t1
        },
        {
            "id": "w2",
            "username": "user_b",
            "warning_type": "radio-outline",
            "title": "Noise",
            "description": "Loud music.",
            "lat": 51.5075,
            "lon": -0.1279,
            "created_at": t2
        },
        {
            "id": "w3",
            "username": "user_c",
            "warning_type": "radio-outline",
            "title": "Noise",
            "description": "Construction.",
            "lat": 51.5300,
            "lon": -0.1400,
            "created_at": t3
        },
        {
            "id": "w4",
            "username": "user_d",
            "warning_type": "people-outline",
            "title": "Crowds",
            "description": "Football match.",
            "lat": 51.5074,
            "lon": -0.1278,
            "created_at": t4
        }
    ])
    
    mock_sens_execute = MagicMock()
    mock_sens_execute.execute.return_value = MagicMock(data=[])
    
    def mock_table_routing(table_name):
        if table_name == "reported_warnings":
            mock_table = MagicMock()
            mock_table.select.return_value = mock_warnings_execute
            return mock_table
        elif table_name == "user_sensitivities":
            mock_table = MagicMock()
            mock_table.select.return_value.in_.return_value = mock_sens_execute
            return mock_table
        return MagicMock()

    mock_supabase.table.side_effect = mock_table_routing

    with patch("app.services.routes.supabase", mock_supabase):
        warnings = asyncio.run(get_user_warnings(username="test_user", generic=True))
        
        # We expect 3 warnings:
        # 1. Cluster of w1 and w2 (sound)
        # 2. w3 (sound, far away)
        # 3. w4 (crowds, different type)
        assert len(warnings) == 3
        
        # Check cluster of w1 and w2
        cluster_w1_w2 = next((w for w in warnings if w["id"] == "w2"), None)
        assert cluster_w1_w2 is not None
        assert cluster_w1_w2["report_count"] == 2
        assert cluster_w1_w2["desc"] == "Loud music."  # clean representative desc

        # Check w3
        warn_w3 = next((w for w in warnings if w["id"] == "w3"), None)
        assert warn_w3 is not None
        assert warn_w3["report_count"] == 1
        assert "[Confidence" not in warn_w3["desc"]

        # Check w4
        warn_w4 = next((w for w in warnings if w["id"] == "w4"), None)
        assert warn_w4 is not None
        assert warn_w4["report_count"] == 1
        assert "[Confidence" not in warn_w4["desc"]
