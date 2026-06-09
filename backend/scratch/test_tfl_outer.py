import asyncio
import httpx
import json

async def main():
    # Burnham Rail Station coordinates: 51.5235, -0.6480
    # Paddington Station coordinates: 51.5173, -0.1772
    url = "https://api.tfl.gov.uk/Journey/JourneyResults/51.5235,-0.6480/to/51.5173,-0.1772"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url)
        if res.status_code != 200:
            print("Response status:", res.status_code)
            return
        
        data = res.json()
        for i, journey in enumerate(data.get("journeys", [])):
            print(f"\nJourney {i}: duration={journey.get('duration')} mins")
            for leg in journey.get("legs", []):
                mode = leg.get("mode", {}).get("name", "unknown")
                departure = leg.get("departurePoint", {}).get("commonName", "")
                arrival = leg.get("arrivalPoint", {}).get("commonName", "")
                line = leg.get("routeOptions", [{}])[0].get("lineIdentifier", {}).get("name", "") if leg.get("routeOptions") else ""
                line_string = leg.get("path", {}).get("lineString")
                print(f"  Leg: mode={mode}, line={line}, from={departure}, to={arrival}")
                if line_string:
                    try:
                        coords = json.loads(line_string)
                        print(f"    Has lineString: {len(coords)} points")
                    except Exception as e:
                        print(f"    Error parsing lineString: {e}")
                else:
                    print("    No lineString")

if __name__ == "__main__":
    asyncio.run(main())
