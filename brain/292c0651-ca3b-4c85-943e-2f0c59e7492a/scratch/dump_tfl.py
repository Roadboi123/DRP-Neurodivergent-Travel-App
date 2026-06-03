import httpx
import json

async def main():
    # Let's try text search for Holborn to South Kensington
    url = "https://api.tfl.gov.uk/Journey/JourneyResults/Holborn/to/South%20Kensington"
    async with httpx.AsyncClient() as client:
        res = await client.get(url)
        print("STATUS:", res.status_code)
        print("RESPONSE CONTENT PREVIEW:", res.text[:2000])

import asyncio
asyncio.run(main())
