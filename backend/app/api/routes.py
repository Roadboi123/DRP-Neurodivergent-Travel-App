import asyncio
from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict, Any

from app.integrations.supabase import supabase
from app.integrations import tlf_client
from app.integrations import gmaps_client
from app.integrations import route_resolver

routes_router = APIRouter(prefix="/routes", tags=["routes"])

# Mapping Supabase integer sensitivities (1 = high sensitivity/little discomfort, 2 = manageable, 3 = dontcare/none)
# to discomfort multiplier weights
WEIGHTS_MAP = {
    1: 3.0,
    2: 1.5,
    3: 0.0
}

def _calculate_leg_sensory(leg: dict) -> tuple[int, int, int, int, int]:
    """
    Determine the sensory profile (Sound, Crowds, Heat, Light, Smell)
    on a 1-3 scale for a single transit/walking leg.
    """
    mode = str(leg.get("mode", "")).lower()
    line = str(leg.get("line", "")).lower()
    instruction = str(leg.get("instruction", "")).lower()
    
    # Defaults (Low / Calm)
    noise, crowds, heat, light, smell = 1, 1, 1, 1, 1
    
    if mode == "walking":
        # Usually quiet, but check if walking segment is near busy spots
        if "station" in instruction or "busy" in instruction or "crowded" in instruction:
            noise, crowds = 2, 2
        else:
            noise, crowds, heat, light, smell = 1, 1, 1, 1, 1
            
    elif mode == "bus":
        noise = 2   # Engine rumble
        crowds = 2  # Moderate congestion
        heat = 2    # Standard bus ventilation
        light = 2   # Standard overhead bulbs + natural windows
        smell = 2   # Diesel exhaust fumes on street/boarding
        
    elif mode in ("tube", "subway", "underground"):
        # Deep level tube lines (Central, Northern, Victoria, Bakerloo, Jubilee, Piccadilly)
        deep_lines = ("central", "northern", "victoria", "bakerloo", "jubilee", "piccadilly")
        if any(dl in line for dl in deep_lines):
            noise = 3   # Deafening rail squeal (can exceed 90dB)
            crowds = 3  # High passenger density
            heat = 3    # Sweltering heat (no air conditioning on deep tube, up to 32C)
            light = 3   # Glaring fluorescent tubes
            smell = 2   # Train dust and metallic air
        else:
            # Sub-surface lines (District, Circle, Hammersmith & City, Metropolitan)
            # Modern, spacious, air-conditioned
            noise = 2   # Moderate screech, wider tunnels
            crowds = 2  # Moderate
            heat = 1    # Fully air-conditioned!
            light = 2   # Standard lighting
            smell = 2   # Mild train dust
            
    elif mode in ("train", "dlr", "overground", "elizabeth-line", "national-rail"):
        if "elizabeth" in line or "elizabeth" in instruction:
            noise = 1   # Brand new, smooth, sound-dampened tracks
            crowds = 2  # Moderate
            heat = 1    # Air-conditioned
            light = 2   # Pleasant recessed soft white lighting
            smell = 1   # Clean, spacious
        else:
            # DLR / Overground / Standard rail
            noise = 2   # Rail noise
            crowds = 2  # Moderate
            heat = 1    # Air-conditioned mostly
            light = 2
            smell = 1   # Better ventilation
            
    else:
        # Unknown or generic transit fallback
        noise, crowds, heat, light, smell = 2, 2, 2, 2, 2
        
    return noise, crowds, heat, light, smell

def _build_route_option(index: int, journey: dict) -> dict:
    """
    Format a fetched API journey route to match the frontend RouteOption model schema.
    """
    legs = journey.get("legs", [])
    
    # Calculate sensory levels per leg, and use max-pooling for overall journey load
    leg_profiles = [_calculate_leg_sensory(leg) for leg in legs]
    if leg_profiles:
        noise = max(p[0] for p in leg_profiles)
        crowds = max(p[1] for p in leg_profiles)
        heat = max(p[2] for p in leg_profiles)
        light = max(p[3] for p in leg_profiles)
        smell = max(p[4] for p in leg_profiles)
    else:
        noise, crowds, heat, light, smell = 1, 1, 1, 1, 1

    # Dynamically generate a premium route name based on major transit segments
    transit_names = []
    for leg in legs:
        mode = str(leg.get("mode", "")).lower()
        line = leg.get("line", "")
        if mode == "bus" and line:
            transit_names.append(f"Bus {line}")
        elif mode in ("tube", "subway", "underground") and line:
            # Append tube line name (e.g. "District Line")
            suffix = " Line" if "line" not in line.lower() else ""
            transit_names.append(f"{line}{suffix}")
        elif line:
            transit_names.append(line)
        elif mode != "walking" and mode != "unknown" and mode != "":
            transit_names.append(mode.capitalize())

    if transit_names:
        # De-duplicate adjacent duplicates
        deduped = []
        for name in transit_names:
            if not deduped or deduped[-1] != name:
                deduped.append(name)
        route_name = " + ".join(deduped)
    else:
        route_name = "Walk"

    # Compute a realistic price (bus: £1.75, tube/train: £2.80 base zone caps)
    price = 0.0
    has_bus = False
    has_rail = False
    for leg in legs:
        mode = str(leg.get("mode", "")).lower()
        if mode == "bus":
            has_bus = True
        elif mode in ("tube", "subway", "underground", "train", "dlr", "overground", "elizabeth-line", "national-rail"):
            has_rail = True
            
    if has_rail:
        price += 2.80
    if has_bus:
        price += 1.75
        
    duration = int(journey.get("duration_mins", 0))
    source = journey.get("source", "tfl")

    # Construct descriptive neurodivergent-friendly leg summary
    desc_parts = []
    has_deep_tube = False
    has_walk_only = all(str(l.get("mode", "")).lower() == "walking" for l in legs)
    
    for leg in legs:
        mode = str(leg.get("mode", "")).lower()
        line = str(leg.get("line", "")).lower()
        if mode in ("tube", "subway", "underground") and any(dl in line for dl in ("central", "northern", "victoria", "bakerloo", "jubilee", "piccadilly")):
            has_deep_tube = True

    if has_walk_only:
        desc_parts.append("A peaceful walking route featuring zero train transfers, fresh air, and outdoor natural light.")
    else:
        if has_deep_tube:
            desc_parts.append("Includes a deep tube line with high screeching noises, standard station congestion, and warmer carriage heat.")
        else:
            desc_parts.append("Uses sub-surface or modern spacious transit lines with air conditioning and quieter tracks.")
            
        changes = max(len([l for l in legs if str(l.get("mode", "")).lower() != "walking"]) - 1, 0)
        if changes > 0:
            desc_parts.append(f"Requires {changes} line transfer{'s' if changes > 1 else ''} which increases walking and platform crowding.")
        else:
            desc_parts.append("Direct line journey with no platform transfers.")

    description = " ".join(desc_parts)
    
    # Formulate sub-name representing transit modes sequence
    modes_list = [str(l.get("mode", "")).capitalize() for l in legs]
    subName = " ➔ ".join(modes_list) if modes_list else None

    # Map legs for front-end rendering
    formatted_legs = []
    for l in legs:
        formatted_legs.append({
            "mode": l.get("mode", "walking"),
            "line": l.get("line", ""),
            "duration_mins": l.get("duration_mins", 0),
            "departure": l.get("departure", ""),
            "arrival": l.get("arrival", ""),
            "instruction": l.get("instruction", ""),
        })

    return {
        "id": f"real_r{index}",
        "name": route_name,
        "subName": subName,
        "duration": duration,
        "price": price,
        "noise": noise,
        "crowds": crowds,
        "heat": heat,
        "light": light,
        "smell": smell,
        "description": description,
        "source": source,
        "legs": formatted_legs,
    }

@routes_router.get("/", response_model=List[Dict[str, Any]])
async def get_routes(start: str, end: str, username: Optional[str] = None):
    """
    Get live routing options resolved from TfL and Google Maps,
    automatically scored and prioritized based on Supabase saved sensory tolerances.
    """
    if not start or not start.strip() or not end or not end.strip():
        return []

    # 1. Resolve strategy (TfL, Google, or Both)
    try:
        strategy_info = await route_resolver.resolve_source(start, end)
        strategy = strategy_info.get("strategy", "both")
    except Exception as e:
        print(f"Route resolver exception: {e}")
        strategy = "both"

    # 2. Query clients in parallel based on strategy
    tfl_task = None
    gmaps_task = None

    if strategy in ("tfl", "both"):
        tfl_task = tlf_client.get_routes(start, end)
    if strategy in ("google", "both"):
        gmaps_task = gmaps_client.get_walking_routes(start, end)

    raw_journeys = []

    try:
        if tfl_task and gmaps_task:
            tfl_res, gmaps_res = await asyncio.gather(tfl_task, gmaps_task, return_exceptions=True)
            if isinstance(tfl_res, list):
                raw_journeys.extend(tfl_res)
            else:
                print(f"TfL fetch error: {tfl_res}")
            if isinstance(gmaps_res, list):
                raw_journeys.extend(gmaps_res)
            else:
                print(f"Google Maps fetch error: {gmaps_res}")
        elif tfl_task:
            tfl_res = await tfl_task
            if isinstance(tfl_res, list):
                raw_journeys.extend(tfl_res)
        elif gmaps_task:
            gmaps_res = await gmaps_task
            if isinstance(gmaps_res, list):
                raw_journeys.extend(gmaps_res)
    except Exception as e:
        print(f"Error querying live routing APIs: {e}")

    # Map raw journeys to frontend schema
    routes = []
    for i, j in enumerate(raw_journeys):
        try:
            routes.append(_build_route_option(i, j))
        except Exception as ex:
            print(f"Error building route option for journey {i}: {ex}")

    if not routes:
        # If real API queries return absolutely nothing, we raise an empty response
        return []

    # 3. Retrieve user preferences from Supabase if username is active
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
            print(f"Error fetching Supabase sensitivities for user {username}: {e}")

    # 4. Calculate personalized match scores for all routes
    for r in routes:
        mismatch_triggers = []
        if user_prefs:
            u_noise = int(user_prefs.get("noise_sensitivity") or 2)
            u_crowds = int(user_prefs.get("crowd_sensitivity") or 2)
            u_heat = int(user_prefs.get("heat_sensitivity") or 2)
            u_light = int(user_prefs.get("light_sensitivity") or 2)
            u_smell = int(user_prefs.get("smell_sensitivity") or 2)

            w_noise = WEIGHTS_MAP.get(u_noise, 1.5)
            w_crowds = WEIGHTS_MAP.get(u_crowds, 1.5)
            w_heat = WEIGHTS_MAP.get(u_heat, 1.5)
            w_light = WEIGHTS_MAP.get(u_light, 1.5)
            w_smell = WEIGHTS_MAP.get(u_smell, 1.5)

            # Lower score is better/calmer
            sensory_score = (
                w_noise * r["noise"] +
                w_crowds * r["crowds"] +
                w_heat * r["heat"] +
                w_light * r["light"] +
                w_smell * r["smell"]
            )
            r["sensory_score"] = round(sensory_score, 2)

            # Mismatches (Highly sensitive [1] and trigger level >= 2)
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

            if len(mismatch_triggers) > 0:
                r["sensory_description"] = f"⚠️ High sensory load: includes triggers ({', '.join(mismatch_triggers)}) that affect you."
            else:
                r["sensory_description"] = "✅ Excellent match: completely aligned with your sensory profile."
        else:
            # Fallback score (simple sum of all 5 metrics)
            sensory_score = float(r["noise"] + r["crowds"] + r["heat"] + r["light"] + r["smell"])
            r["sensory_score"] = sensory_score
            r["match_percentage"] = int(max(0, 100 - (sensory_score / 15) * 60))
            r["sensory_description"] = "Enter a username to view personalized sensory alignment ratings."

    # 5. Determine types: safest/calmest vs. quickest
    quickest_route = min(routes, key=lambda x: x["duration"])
    best_route = min(routes, key=lambda x: x["sensory_score"])

    for r in routes:
        if r["id"] == best_route["id"]:
            r["type"] = "best"
        elif r["id"] == quickest_route["id"]:
            r["type"] = "quickest"
        else:
            r["type"] = "suggested"

    # Sort so calmest/best route is highlighted first
    routes.sort(key=lambda x: (0 if x["type"] == "best" else 1 if x["type"] == "quickest" else 2))

    return routes

