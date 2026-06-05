import asyncio
import httpx

async def main():
    url = "https://api.tfl.gov.uk/StopPoint/Mode/tube/Disruption"
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        if res.status_code == 200:
            data = res.json()
            print(f"Total disruptions: {len(data)}")
            for idx, d in enumerate(data[:30]):
                desc = d.get("description", "")
                common_name = d.get("commonName", "")
                print(f"{idx + 1}. [{common_name}]: {desc[:100]}...")
        else:
            print(f"Failed: {res.status_code}")

if __name__ == "__main__":
    asyncio.run(main())
