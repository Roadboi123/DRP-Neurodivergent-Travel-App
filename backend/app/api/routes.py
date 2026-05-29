from fastapi import APIRouter
from typing import Optional, List, Dict, Any
from app.integrations.supabase import supabase

routes_router = APIRouter(prefix="/routes", tags=["routes"])

# Base routes database - Min-maxed for sensory specialization
# - Bus 345: Specialized in Sound (1) & Smell (1) but has bright lights (3). (Best for Sound-sensitive).
# - Bus 49: Specialized in Light (1) & Heat (1) but is very noisy (3) and smelly (3). (Best for Light-sensitive).
# - District Line: Specialized in Crowds (1) but has average metrics elsewhere. (Best for Crowd-sensitive).
# - Central Line: Extremely intense across all triggers (3). (Ultimate challenge route).
ROUTES_DATABASE: List[Dict[str, Any]] = [
    {
        "id": "r1",
        "name": "Bus 345",
        "subName": None,
        "duration": 50,
        "price": 1.75,
        "noise": 1,      # Sound: Low (whisper quiet)
        "crowds": 2,     # Crowds: Moderate
        "heat": 2,       # Heat: Moderate
        "light": 3,      # Light: High (bright glaring overhead lights)
        "smell": 1,      # Smell: Low (clean, fragrance-free)
        "description": "Whisper-quiet and fragrance-free bus, though bright glaring overhead lighting is active.",
    },
    {
        "id": "r2",
        "name": "Bus 49",
        "subName": "Walk",
        "duration": 43,
        "price": 1.75,
        "noise": 3,      # Sound: High (heavy rumbling engine)
        "crowds": 2,     # Crowds: Moderate
        "heat": 1,       # Heat: Low (strong ice-cold A/C)
        "light": 1,      # Light: Low (tinted windows & soft dim lighting)
        "smell": 3,      # Smell: High (diesel exhaust fumes on transfer)
        "description": "Dimly lit and cool commute, though engine rumble and diesel exhaust fumes are high.",
    },
    {
        "id": "r3",
        "name": "Bus 170",
        "subName": "District Line + Walk",
        "duration": 51,
        "price": 4.85,
        "noise": 2,      # Sound: Moderate (standard rail rattle)
        "crowds": 1,     # Crowds: Low (plentiful seats/uncrowded cars today)
        "heat": 2,       # Heat: Moderate
        "light": 2,      # Light: Moderate
        "smell": 2,      # Smell: Moderate (standard station air)
        "description": "Standard subway link featuring spacious uncrowded compartments, but moderate screeching.",
    },
    {
        "id": "r4",
        "name": "Bus 170",
        "subName": "Central Line + Walk",
        "duration": 55,
        "price": 4.85,
        "noise": 3,      # Sound: High (deafening deep-tube rail screeching)
        "crowds": 3,     # Crowds: High (rush hour congestion)
        "heat": 3,       # Heat: High (deep level line, reaches 32°C)
        "light": 3,      # Light: High (fluorescent station bulbs)
        "smell": 2,      # Smell: Moderate
        "description": "Fast tube connection, but has screeching deep-level rails, packed crowds, extreme heat, and glaring station bulbs.",
    },
]

# Mapping Supabase integer sensitivities (1 = little/high sensitivity, 2 = manageable/med, 3 = dontcare/none)
# to discomfort multiplier weights
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
            # Add small sensory variations
            r["light"] = min(3, max(1, r["light"] + (seed % 2) - 1))
            r["smell"] = min(3, max(1, r["smell"] + ((seed + 1) % 2) - 1))

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
        mismatch_triggers = []
        if user_prefs:
            # Retrieve user sensitivities (default to 2 if not found in db record)
            u_noise = int(user_prefs.get("noise_sensitivity") or 2)
            u_crowds = int(user_prefs.get("crowd_sensitivity") or 2)
            u_heat = int(user_prefs.get("heat_sensitivity") or 2)
            u_light = int(user_prefs.get("light_sensitivity") or 2)
            u_smell = int(user_prefs.get("smell_sensitivity") or 2)

            # Get weights
            w_noise = WEIGHTS_MAP.get(u_noise, 1.5)
            w_crowds = WEIGHTS_MAP.get(u_crowds, 1.5)
            w_heat = WEIGHTS_MAP.get(u_heat, 1.5)
            w_light = WEIGHTS_MAP.get(u_light, 1.5)
            w_smell = WEIGHTS_MAP.get(u_smell, 1.5)

            # Calculate score (lower score = less discomfort = calmer route)
            sensory_score = (
                w_noise * r["noise"] +
                w_crowds * r["crowds"] +
                w_heat * r["heat"] +
                w_light * r["light"] +
                w_smell * r["smell"]
            )
            r["sensory_score"] = round(sensory_score, 2)

            # Identify specific triggers causing discomfort (user has high sensitivity [1] and route trigger level >= 2)
            if u_noise == 1 and r["noise"] >= 2:
                mismatch_triggers.append("sound")
            if u_crowds == 1 and r["crowds"] >= 2:
                mismatch_triggers.append("crowds")
            if u_heat == 1 and r["heat"] >= 2:
                mismatch_triggers.append("heat")
            if u_light == 1 and r["light"] >= 2:
                mismatch_triggers.append("bright light")
            if u_smell == 1 and r["smell"] >= 2:
                mismatch_triggers.append("fumes/scents")

            # Max discomfort bound mapping
            max_discomfort = (
                w_noise * 3 +
                w_crowds * 3 +
                w_heat * 3 +
                w_light * 3 +
                w_smell * 3
            )
            
            if max_discomfort > 0:
                match_pct = max(0, min(100, int(100 - (sensory_score / max_discomfort) * 100)))
            else:
                match_pct = 100
                
            r["match_percentage"] = match_pct

            # Generate dynamic sensory description
            if len(mismatch_triggers) > 0:
                r["sensory_description"] = f"⚠️ High sensory load: includes triggers ({', '.join(mismatch_triggers)}) that affect you."
            else:
                r["sensory_description"] = "✅ Excellent match: completely aligned with your sensory profile."
        else:
            # Fallback score if no user profile is loaded (simple sum of all 5 metrics)
            sensory_score = float(r["noise"] + r["crowds"] + r["heat"] + r["light"] + r["smell"])
            r["sensory_score"] = sensory_score
            # Default fallback match percentage mapping
            r["match_percentage"] = int(max(0, 100 - (sensory_score / 15) * 60))
            r["sensory_description"] = "Enter a username to view personalized sensory alignment ratings."

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
