import asyncio
import httpx

async def main():
    origin = "51.4944,-0.1829"
    destination = "51.4989595,-0.1756407"
    
    url = f"https://api.tfl.gov.uk/Journey/JourneyResults/{origin}/to/{destination}"
    params = {
        "alternativeWalking": "true",
        "nationalSearch":     "true",
        "maxWalkingMinutes":  "60",
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url, params=params)
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            journeys = data.get("journeys", [])
            print(f"Found {len(journeys)} journeys.")
            for i, j in enumerate(journeys):
                print(f"Journey {i}: duration={j.get('duration')} mins")
                for leg in j.get("legs", []):
                    print(f"  Leg: mode={leg.get('mode', {}).get('id')} ({leg.get('duration')} mins) instruction={leg.get('instruction', {}).get('summary')}")

if __name__ == "__main__":
    asyncio.run(main())
