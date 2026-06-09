import asyncio
import httpx
import json

async def main():
    url = "https://api.tfl.gov.uk/Journey/JourneyResults/51.5235,-0.6480/to/51.5173,-0.1772"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url)
        if res.status_code != 200:
            print("Response status:", res.status_code)
            return
        
        data = res.json()
        for i, journey in enumerate(data.get("journeys", [])):
            for leg in journey.get("legs", []):
                mode = leg.get("mode", {}).get("name", "unknown")
                if mode == "elizabeth-line" or mode == "tube":
                    stop_points = leg.get("path", {}).get("stopPoints", [])
                    print(f"\nMode: {mode}, stops count: {len(stop_points)}")
                    if stop_points:
                        print("Sample stopPoint keys:", stop_points[0].keys())
                        print("Sample stopPoint content:", json.dumps(stop_points[0], indent=2))
                    return

if __name__ == "__main__":
    asyncio.run(main())
