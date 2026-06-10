from pydantic import BaseModel
from typing import Optional

class JourneyMetricsCreate(BaseModel):
    time_to_start_seconds: Optional[float] = None
    actions_in_timeframe: Optional[int] = None
    route_changed_after_warning: Optional[bool] = None
    app_accesses_during_journey: Optional[int] = None
    warning_clicked_for_info: Optional[bool] = None

class DisruptionReportMetricsCreate(BaseModel):
    time_taken_seconds: Optional[float] = None
    would_contribute: Optional[bool] = None

class MetricsSummary(BaseModel):
    avg_time_to_start_seconds: Optional[float] = None
    avg_actions_in_timeframe: Optional[float] = None
    avg_time_taken_to_report: Optional[float] = None
    pct_would_contribute: Optional[float] = None
    pct_route_changed_after_warning: Optional[float] = None
    avg_app_accesses_during_journey: Optional[float] = None
    pct_warning_clicked_for_info: Optional[float] = None
