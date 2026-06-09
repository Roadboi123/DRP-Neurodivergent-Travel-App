import asyncio
import httpx
import json

async def main():
    url = "https://api.tfl.gov.uk/Journey/JourneyResults/51.5173,-0.1772/to/51.5416,-0.0039"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url)
        if res.status_code != 200:
            print("Response status:", res.status_code)
            return
        
        data = res.json()
        for journey in data.get("journeys", []):
            for leg in journey.get("legs", []):
                mode = leg.get("mode", {}).get("name", "unknown")
                if mode == "elizabeth-line":
                    line_string = leg.get("path", {}).get("lineString")
                    if line_string:
                        coords = json.loads(line_string)
                        print("\nElizabeth line first 25 points:")
                        for idx, pt in enumerate(coords[:25]):
                            print(f"  Point {idx}: {pt}")
                        return

if __name__ == "__main__":
    asyncio.run(main())
