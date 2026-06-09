import asyncio
import httpx
import json

async def main():
    # Maidenhead: 51.5218, -0.7142
    # Taplow: 51.5244, -0.6800
    url = "https://api.tfl.gov.uk/Journey/JourneyResults/51.5218,-0.7142/to/51.5244,-0.6800"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url)
        if res.status_code != 200:
            print("Response status:", res.status_code)
            return
        
        data = res.json()
        for i, journey in enumerate(data.get("journeys", [])):
            for leg in journey.get("legs", []):
                mode = leg.get("mode", {}).get("name", "unknown")
                departure = leg.get("departurePoint", {}).get("commonName", "")
                arrival = leg.get("arrivalPoint", {}).get("commonName", "")
                print(f"Leg: mode={mode}, from={departure}, to={arrival}")
                
                line_string = leg.get("path", {}).get("lineString")
                if line_string:
                    coords = json.loads(line_string)
                    print(f"  Coordinates count: {len(coords)}")
                    print(f"  First 5: {coords[:5]}")
                    print(f"  Last 5: {coords[-5:]}")
                else:
                    print("  No lineString")

if __name__ == "__main__":
    asyncio.run(main())
