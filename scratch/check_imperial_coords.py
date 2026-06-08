import asyncio
from app.integrations.osm_client import geocode
from app.integrations.route_resolver import _haversine_distance

async def main():
    queries = ["imp", "impe", "imper", "imperi", "imperial", "imperial college", "imperial college london"]
    origin = "Current Location"
    orig_coords = await geocode(origin)
    
    for dest in queries:
        dest_coords = await geocode(dest)
        print(f"Destination '{dest}': {dest_coords}")
        if orig_coords and dest_coords:
            dist = _haversine_distance(orig_coords[0], orig_coords[1], dest_coords[0], dest_coords[1])
            print(f"  Distance: {dist:.1f} meters")
            # Check strategy
            from app.integrations.route_resolver import resolve_source
            strat = await resolve_source(origin, dest)
            print(f"  Strategy: {strat}")



if __name__ == "__main__":
    asyncio.run(main())
