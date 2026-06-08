import asyncio
import httpx

async def main():
    origin = "51.4944,-0.1829"
    destination = "imperial college london"
    
    url = f"https://api.tfl.gov.uk/Journey/JourneyResults/{origin}/to/{destination}"
    params = {
        "alternativeWalking": "true",
        "nationalSearch":     "true",
        "maxWalkingMinutes":  "60",
    }
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url, params=params)
        print(f"Status: {res.status_code}")
        if res.status_code == 300:
            print("Received 300 Multiple Choices!")
            try:
                print(res.json().keys())
            except Exception:
                pass
        elif res.status_code == 200:
            data = res.json()
            journeys = data.get("journeys", [])
            print(f"Found {len(journeys)} journeys.")

if __name__ == "__main__":
    asyncio.run(main())
