from typing import Optional
import jwt
from fastapi import APIRouter, Depends
from app.api.auth import oauth2_scheme, ALGORITHM, JWT_SECRET
from app.integrations.supabase import supabase
from app.schemas.metrics import JourneyMetricsCreate, DisruptionReportMetricsCreate, MetricsSummary

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.post("/journey")
async def report_journey_metrics(
    body: JourneyMetricsCreate,
    token: Optional[str] = Depends(oauth2_scheme),
):
    """Store journey behavior metrics (times, clicks, changes)."""
    resolved_username = None
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            resolved_username = payload.get("sub")
        except Exception:
            pass

    row = {
        "username": resolved_username,
        "time_to_start_seconds": body.time_to_start_seconds,
        "actions_in_timeframe": body.actions_in_timeframe,
        "route_changed_after_warning": body.route_changed_after_warning,
        "app_accesses_during_journey": body.app_accesses_during_journey,
        "warning_clicked_for_info": body.warning_clicked_for_info,
    }

    supabase.table("journey_metrics").insert(row).execute()
    return {"status": "success", "message": "Journey metrics logged successfully"}


@router.post("/disruption")
async def report_disruption_metrics(
    body: DisruptionReportMetricsCreate,
    token: Optional[str] = Depends(oauth2_scheme),
):
    """Store disruption reporting metrics (time taken, contribution prompt response)."""
    resolved_username = None
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
            resolved_username = payload.get("sub")
        except Exception:
            pass

    row = {
        "username": resolved_username,
        "time_taken_seconds": body.time_taken_seconds,
        "would_contribute": body.would_contribute,
    }

    supabase.table("disruption_report_metrics").insert(row).execute()
    return {"status": "success", "message": "Disruption report metrics logged successfully"}


@router.get("/summary", response_model=MetricsSummary)
async def get_metrics_summary():
    """Retrieve the average values and percentages of all logged user metrics."""
    res_journey = supabase.table("journey_metrics").select("*").execute()
    res_disruption = supabase.table("disruption_report_metrics").select("*").execute()

    journeys = res_journey.data or []
    disruptions = res_disruption.data or []

    summary = MetricsSummary()

    # Process journey metrics
    times_to_start = [j["time_to_start_seconds"] for j in journeys if j.get("time_to_start_seconds") is not None]
    actions = [j["actions_in_timeframe"] for j in journeys if j.get("actions_in_timeframe") is not None]
    route_changes = [j["route_changed_after_warning"] for j in journeys if j.get("route_changed_after_warning") is not None]
    app_accesses = [j["app_accesses_during_journey"] for j in journeys if j.get("app_accesses_during_journey") is not None]
    warning_clicks = [j["warning_clicked_for_info"] for j in journeys if j.get("warning_clicked_for_info") is not None]

    if times_to_start:
        summary.avg_time_to_start_seconds = sum(times_to_start) / len(times_to_start)
    if actions:
        summary.avg_actions_in_timeframe = sum(actions) / len(actions)
    if route_changes:
        summary.pct_route_changed_after_warning = (sum(1 for rc in route_changes if rc is True) * 100.0) / len(route_changes)
    if app_accesses:
        summary.avg_app_accesses_during_journey = sum(app_accesses) / len(app_accesses)
    if warning_clicks:
        summary.pct_warning_clicked_for_info = (sum(1 for wc in warning_clicks if wc is True) * 100.0) / len(warning_clicks)

    # Process disruption metrics
    times_to_report = [d["time_taken_seconds"] for d in disruptions if d.get("time_taken_seconds") is not None]
    contributions = [d["would_contribute"] for d in disruptions if d.get("would_contribute") is not None]

    if times_to_report:
        summary.avg_time_taken_to_report = sum(times_to_report) / len(times_to_report)
    if contributions:
        summary.pct_would_contribute = (sum(1 for c in contributions if c is True) * 100.0) / len(contributions)

    return summary
