import asyncio
import httpx

async def main():
    url = "https://api.tfl.gov.uk/StopPoint/910GSLOUGH"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url)
        if res.status_code != 200:
            print("Response status:", res.status_code)
            return
        
        data = res.json()
        print("Keys returned:", data.keys())
        print(f"Lat: {data.get('lat')}, Lon: {data.get('lon')}")
        print(f"Common Name: {data.get('commonName')}")

if __name__ == "__main__":
    asyncio.run(main())
