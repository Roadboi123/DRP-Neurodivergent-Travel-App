from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_post_journey_metrics():
    # Mock supabase client
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    
    with patch("app.api.metrics.supabase", mock_supabase):
        payload = {
            "time_to_start_seconds": 45.5,
            "actions_in_timeframe": 5,
            "route_changed_after_warning": True,
            "app_accesses_during_journey": 2,
            "warning_clicked_for_info": False
        }
        res = client.post("/metrics/journey", json=payload)
        
        assert res.status_code == 200
        assert res.json() == {"status": "success", "message": "Journey metrics logged successfully"}
        
        # Verify that insert was called on "journey_metrics" with the correct data
        mock_supabase.table.assert_called_with("journey_metrics")
        mock_table.insert.assert_called_once()
        args, kwargs = mock_table.insert.call_args
        inserted_row = args[0]
        assert inserted_row["time_to_start_seconds"] == 45.5
        assert inserted_row["actions_in_timeframe"] == 5
        assert inserted_row["route_changed_after_warning"] is True
        assert inserted_row["app_accesses_during_journey"] == 2
        assert inserted_row["warning_clicked_for_info"] is False


def test_post_disruption_metrics():
    mock_supabase = MagicMock()
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    
    with patch("app.api.metrics.supabase", mock_supabase):
        payload = {
            "time_taken_seconds": 12.3,
            "would_contribute": True
        }
        res = client.post("/metrics/disruption", json=payload)
        
        assert res.status_code == 200
        assert res.json() == {"status": "success", "message": "Disruption report metrics logged successfully"}
        
        # Verify insert
        mock_supabase.table.assert_called_with("disruption_report_metrics")
        mock_table.insert.assert_called_once()
        args, _ = mock_table.insert.call_args
        inserted_row = args[0]
        assert inserted_row["time_taken_seconds"] == 12.3
        assert inserted_row["would_contribute"] is True


def test_get_metrics_summary():
    mock_supabase = MagicMock()
    
    # Mock data returned from DB
    journey_mock_data = [
        {"time_to_start_seconds": 30.0, "actions_in_timeframe": 4, "route_changed_after_warning": True, "app_accesses_during_journey": 1, "warning_clicked_for_info": True},
        {"time_to_start_seconds": 60.0, "actions_in_timeframe": 6, "route_changed_after_warning": False, "app_accesses_during_journey": 3, "warning_clicked_for_info": False},
        {"time_to_start_seconds": None, "actions_in_timeframe": None, "route_changed_after_warning": None, "app_accesses_during_journey": None, "warning_clicked_for_info": None},
    ]
    disruption_mock_data = [
        {"time_taken_seconds": 10.0, "would_contribute": True},
        {"time_taken_seconds": 20.0, "would_contribute": False},
    ]
    
    def mock_table_select(table_name):
        mock_query = MagicMock()
        mock_execute = MagicMock()
        if table_name == "journey_metrics":
            mock_execute.data = journey_mock_data
        elif table_name == "disruption_report_metrics":
            mock_execute.data = disruption_mock_data
        else:
            mock_execute.data = []
            
        mock_query.select.return_value.execute.return_value = mock_execute
        return mock_query

    mock_supabase.table.side_effect = mock_table_select
    
    with patch("app.api.metrics.supabase", mock_supabase):
        res = client.get("/metrics/summary")
        assert res.status_code == 200
        data = res.json()
        
        # Check calculation accuracy:
        # avg time to start: (30 + 60) / 2 = 45.0
        assert data["avg_time_to_start_seconds"] == 45.0
        
        # avg actions: (4 + 6) / 2 = 5.0
        assert data["avg_actions_in_timeframe"] == 5.0
        
        # pct route changed: 1 True out of 2 non-nulls = 50.0%
        assert data["pct_route_changed_after_warning"] == 50.0
        
        # avg app accesses: (1 + 3) / 2 = 2.0
        assert data["avg_app_accesses_during_journey"] == 2.0
        
        # pct warning clicked: 1 True out of 2 non-nulls = 50.0%
        assert data["pct_warning_clicked_for_info"] == 50.0
        
        # avg time to report: (10 + 20) / 2 = 15.0
        assert data["avg_time_taken_to_report"] == 15.0
        
        # pct would contribute: 1 True out of 2 non-nulls = 50.0%
        assert data["pct_would_contribute"] == 50.0
