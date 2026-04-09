import asyncio, httpx, os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path("scripts/.env"))
KEY = os.getenv("SCRAPERAPI_KEY", "")

async def save():
    async with httpx.AsyncClient(verify=False, timeout=90) as client:
        for attempt in range(3):
            print(f"Attempt {attempt+1}...")
            r = await client.get("https://api.scraperapi.com", params={
                "api_key": KEY, "url": "https://www.meesho.com/search?q=electronics",
                "render": "true", "country_code": "in",
            })
            print(f"Status: {r.status_code} | Length: {len(r.text)}")
            if r.status_code == 200 and len(r.text) > 10000:
                # Save full HTML
                Path("scripts/meesho_debug.html").write_text(r.text, encoding="utf-8")
                print("Saved to scripts/meesho_debug.html")
                # Find the first /p/ link and print 800 chars around it
                text = r.text
                idx = text.find("/p/")
                if idx > 0:
                    print("\nContext around first product link:")
                    print(text[max(0,idx-400):idx+400])
                break
            await asyncio.sleep(3)

asyncio.run(save())
