import httpx
import json
import asyncio

async def main():
    origin_lon, origin_lat = -0.1200, 51.5173
    dest_lon, dest_lat = -0.1730, 51.4941
    osrm_url = f"https://router.project-osrm.org/route/v1/foot/{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
        "alternatives": "true"
    }
    headers = {"User-Agent": "CalmTravelApp/1.0 (sivat@uniwork.drp)"}
    
    async with httpx.AsyncClient() as client:
        res = await client.get(osrm_url, params=params, headers=headers)
        data = res.json()
        print(f"OSRM code: {data.get('code')}")
        routes = data.get("routes", [])
        if routes:
            route = routes[0]
            geom = route.get("geometry", {})
            print(f"Geometry type: {geom.get('type')}")
            coords = geom.get("coordinates", [])
            print(f"Number of coordinates: {len(coords)}")
            if coords:
                print(f"First 3 coordinates: {coords[:3]}")

if __name__ == "__main__":
    asyncio.run(main())
