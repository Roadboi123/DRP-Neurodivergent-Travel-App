from fastapi import APIRouter
from typing import Optional, List, Dict, Any
from app.integrations.supabase import supabase

routes_router = APIRouter(prefix="/routes", tags=["routes"])

# Base routes data (preset/dummy data from wireframe)
# Now enhanced with 4 sensory metrics: noise, crowds, heat, light
ROUTES_DATABASE: List[Dict[str, Any]] = [
    {
        "id": "r1",
        "name": "Bus 345",
        "subName": None,
        "duration": 50,
        "price": 1.75,
        "noise": 1,      # Sound: Low
        "crowds": 1,     # Crowds: Low
        "heat": 2,       # Heat: Moderate
        "light": 1,      # Light: Low (soft lighting)
        "description": "Sensory preference route. Usually quiet and air-conditioned with dim lighting.",
    },
    {
        "id": "r2",
        "name": "Bus 49",
        "subName": "Walk",
        "duration": 43,
        "price": 1.75,
        "noise": 3,      # Sound: High
        "crowds": 2,     # Crowds: Moderate
        "heat": 3,       # Heat: High
        "light": 2,      # Light: Moderate
        "description": "Saves 7 mins, but includes a noisy intersection and crowded bus boarding.",
    },
    {
        "id": "r3",
        "name": "Bus 170",
        "subName": "District Line + Walk",
        "duration": 51,
        "price": 4.85,
        "noise": 2,      # Sound: Moderate
        "crowds": 2,     # Crowds: Moderate
        "heat": 2,       # Heat: Moderate
        "light": 2,      # Light: Moderate
        "description": "Standard tube link. Watch out for potential minor platform crowding and average lights.",
    },
    {
        "id": "r4",
        "name": "Bus 170",
        "subName": "Central Line + Walk",
        "duration": 55,
        "price": 4.85,
        "noise": 2,      # Sound: Moderate
        "crowds": 2,     # Crowds: Moderate
        "heat": 3,       # Heat: High
        "light": 3,      # Light: High (very bright platform lights)
        "description": "Central Line tube runs deep, get extremely hot, and has bright, flashing station lights.",
    },
]

# Mapping Supabase integer sensitivities (1 = little/high sensitivity, 2 = manageable/med, 3 = dontcare/none)
# to discomfort multiplier weights
# Sensitivity 1 (little tolerance) ➔ High multiplier weight (3.0)
# Sensitivity 2 (manageable tolerance) ➔ Medium multiplier weight (1.5)
# Sensitivity 3 (dontcare tolerance) ➔ No multiplier weight (0.0)
WEIGHTS_MAP = {
    1: 3.0,
    2: 1.5,
    3: 0.0
}

@routes_router.get("/", response_model=List[Dict[str, Any]])
def get_routes(start: str, end: str, username: Optional[str] = None):
    """
    Get route suggestions based on start/end destinations,
    optionally applying personalized user sensitivities from Supabase.
    """
    routes = [r.copy() for r in ROUTES_DATABASE]

    # Dynamically generate slight route duration/cost shifts if inputs are changed from default
    is_default = (
        start.lower().strip() == "current location" or "current" in start.lower()
    ) and (
        end.lower().strip() == "imperial college london" or "imperial" in end.lower()
    )

    if not is_default:
        # Create slightly modified data based on input length to make it dynamic
        seed = (len(start) + len(end)) % 5
        for i, r in enumerate(routes):
            r["duration"] = r["duration"] + (seed * 2) - 4
            r["price"] = round(r["price"] + (seed * 0.1), 2)
            # Add small sensory changes
            r["light"] = min(3, max(1, r["light"] + (seed % 2) - 1))

    # Fetch user preferences from Supabase if username is provided
    user_prefs: Optional[Dict[str, Any]] = None
    if username and username.strip():
        try:
            res = supabase.table("user_sensitivities") \
                .select("*") \
                .eq("username", username.strip()) \
                .execute()
            
            if res.data and isinstance(res.data, list) and len(res.data) > 0:
                prefs_data = res.data[0]
                if isinstance(prefs_data, dict):
                    user_prefs = prefs_data
        except Exception as e:
            # Fallback gracefully if database lookup fails
            print(f"Error fetching sensitivities for {username}: {e}")

    # Compute sensory discomfort scores for all routes
    for r in routes:
        if user_prefs:
            # Retrieve user sensitivities (default to 2 if not found in db record)
            u_noise = int(user_prefs.get("noise_sensitivity") or 2)
            u_crowds = int(user_prefs.get("crowd_sensitivity") or 2)
            u_heat = int(user_prefs.get("heat_sensitivity") or 2)
            u_light = int(user_prefs.get("light_sensitivity") or 2)

            # Get weights
            w_noise = WEIGHTS_MAP.get(u_noise, 1.5)
            w_crowds = WEIGHTS_MAP.get(u_crowds, 1.5)
            w_heat = WEIGHTS_MAP.get(u_heat, 1.5)
            w_light = WEIGHTS_MAP.get(u_light, 1.5)

            # Calculate score (lower score = less discomfort = better)
            sensory_score = (
                w_noise * r["noise"] +
                w_crowds * r["crowds"] +
                w_heat * r["heat"] +
                w_light * r["light"]
            )
            r["sensory_score"] = round(sensory_score, 2)
        else:
            # Fallback score if no user profile is loaded (simple sum of route levels)
            r["sensory_score"] = float(r["noise"] + r["crowds"] + r["heat"] + r["light"])

    # Determine "quickest" route
    quickest_route = min(routes, key=lambda x: x["duration"])
    
    # Determine "best" route (lowest sensory discomfort score)
    best_route = min(routes, key=lambda x: x["sensory_score"])

    # Assign route types
    for r in routes:
        if r["id"] == best_route["id"]:
            r["type"] = "best"
        elif r["id"] == quickest_route["id"]:
            r["type"] = "quickest"
        else:
            r["type"] = "suggested"

    return routes
