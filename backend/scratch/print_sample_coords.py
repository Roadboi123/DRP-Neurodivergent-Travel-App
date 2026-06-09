import asyncio
import httpx
import json

async def main():
    url = "https://api.tfl.gov.uk/Journey/JourneyResults/51.5168,-0.2673/to/51.5159,-0.1759"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url)
        if res.status_code != 200:
            return
        
        data = res.json()
        for journey in data.get("journeys", []):
            for leg in journey.get("legs", []):
                mode = leg.get("mode", {}).get("name", "unknown")
                if mode == "elizabeth-line":
                    line_string = leg.get("path", {}).get("lineString")
                    if line_string:
                        coords = json.loads(line_string)
                        # Print coords at regular intervals to map the path
                        step = len(coords) // 10
                        print("Sample coordinates along the Elizabeth line leg:")
                        for idx in range(0, len(coords), step):
                            print(f"Index {idx}: {coords[idx]}")
                        return

if __name__ == "__main__":
    asyncio.run(main())
