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
            data = res.json()
            to_disambig = data.get("toLocationDisambiguation", {})
            print("toLocationDisambiguation keys:", to_disambig.keys())
            options = to_disambig.get("disambiguationOptions", [])
            print(f"Found {len(options)} options:")
            for opt in options[:3]:
                print("Option:")
                print("  parameterValue:", opt.get("parameterValue"))
                place = opt.get("place", {})
                print("  place name:", place.get("name"))
                print("  place lat/lon:", place.get("lat"), place.get("lon"))
                print("  place icsCode:", place.get("icsCode"))

if __name__ == "__main__":
    asyncio.run(main())
