from fastapi import APIRouter, HTTPException, Query
from services.tfl_client  import get_routes         as get_tfl_routes
from services.gmaps_client import get_walking_routes as get_google_routes
from services.route_resolver import resolve_source

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("/")
async def get_all_routes(
    origin:      str = Query(..., description="NaPTAN ID, lat,lon, postcode, or place name"),
    destination: str = Query(..., description="NaPTAN ID, lat,lon, postcode, or place name"),
    time:        str | None = Query(None, description="Departure time HHMM e.g. 0830"),
):
    """
    Returns all possible routes between origin and destination.

    Automatically selects the best data source:
    - TfL Journey Planner for public transport routes
    - Google Maps Directions for walking, parks, and off-road destinations
    - Both when it makes sense to show all options

    Examples:
      GET /routes/?origin=Bank Station&destination=Waterloo Station
      GET /routes/?origin=51.5074,-0.1278&destination=Speakers Corner, Hyde Park
      GET /routes/?origin=EC2V8RT&destination=Hampstead Heath Ponds
    """
    strategy_info = await resolve_source(origin, destination)
    strategy      = strategy_info["strategy"]

    results = []
    errors  = []

    # Fetch TfL routes
    if strategy in ("tfl", "both"):
        try:
            tfl_routes = await get_tfl_routes(
                origin, destination, time,
                walking_only=strategy_info["walking_only"],
            )
            results.extend(tfl_routes)
        except Exception as e:
            errors.append(f"TfL: {str(e)}")

    # Fetch Google walking routes
    if strategy in ("google", "both"):
        try:
            google_routes = await get_google_routes(origin, destination)
            results.extend(google_routes)
        except Exception as e:
            errors.append(f"Google: {str(e)}")

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No routes found. Errors: {'; '.join(errors)}" if errors else "No routes found",
        )

    # Sort all routes by duration so shortest appears first
    results.sort(key=lambda r: r["duration_mins"])

    return {
        "strategy": strategy,
        "reason":   strategy_info["reason"],
        "count":    len(results),
        "routes":   results,
    }