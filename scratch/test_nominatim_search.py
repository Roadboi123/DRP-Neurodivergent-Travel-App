import asyncio
import httpx

async def test_search():
    headers = {"User-Agent": "CalmTravelApp/1.0 (sivat@uniwork.drp)"}
    params = {
        "q": "st johns wood OR st john's wood",
        "format": "json",
        "limit": "10",
        "countrycodes": "gb",
        "viewbox": "-0.60,51.75,0.35,51.25"  # Greater London
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
        data = res.json()
        for idx, item in enumerate(data):
            print(f"[{idx}] display_name: {item.get('display_name')}")
            print(f"    lat: {item.get('lat')}, lon: {item.get('lon')}")
            print(f"    class: {item.get('class')}, type: {item.get('type')}")
            print(f"    importance: {item.get('importance')}")
            print("-" * 40)

asyncio.run(test_search())
