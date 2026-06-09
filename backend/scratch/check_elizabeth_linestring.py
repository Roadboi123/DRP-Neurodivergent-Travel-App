import asyncio
import httpx
import json

async def main():
    # Acton Main Line: 51.5168, -0.2673
    # Paddington: 51.5159, -0.1759
    url = "https://api.tfl.gov.uk/Journey/JourneyResults/51.5168,-0.2673/to/51.5159,-0.1759"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url)
        if res.status_code != 200:
            print("Response status:", res.status_code)
            return
        
        data = res.json()
        for i, journey in enumerate(data.get("journeys", [])):
            for leg in journey.get("legs", []):
                mode = leg.get("mode", {}).get("name", "unknown")
                if mode == "elizabeth-line":
                    line_string = leg.get("path", {}).get("lineString")
                    if line_string:
                        coords = json.loads(line_string)
                        print(f"Elizabeth line leg from {leg['departurePoint']['commonName']} to {leg['arrivalPoint']['commonName']}")
                        print(f"Coordinates count: {len(coords)}")
                        print(f"First 10 coords: {coords[:10]}")
                        print(f"Last 10 coords: {coords[-10:]}")
                        return
                    else:
                        print("No lineString for Elizabeth line leg")

if __name__ == "__main__":
    asyncio.run(main())
