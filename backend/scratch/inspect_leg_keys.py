import asyncio
import httpx

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
                if mode == "elizabeth-line":
                    print("Leg keys:", leg.keys())
                    print("Leg path keys:", leg.get("path", {}).keys())
                    return

if __name__ == "__main__":
    asyncio.run(main())
