import asyncio
import json
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

async def test_meesho_api():
    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
        )
        page = await context.new_page()
        
        all_responses = []
        async def handle_response(response):
            try:
                # Capture all JSON responses
                ct = response.headers.get("content-type", "")
                if "json" in ct and response.status in [200, 201]:
                    try:
                        data = await response.json()
                        all_responses.append({"url": response.url, "data": data})
                        print(f"[JSON] {response.status} → {response.url[:100]}")
                    except:
                        pass
            except:
                pass
        
        page.on("response", handle_response)
        
        url = "https://www.meesho.com/fashion"
        print(f"\nNavigating to {url}... (capturing ALL JSON responses)")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3000)
        
        # Scroll aggressively to trigger product list loading
        for i in range(5):
            await page.evaluate(f"window.scrollBy(0, {(i+1)*600})")
            await page.wait_for_timeout(1500)
        
        print(f"\n[TOTAL JSON RESPONSES]: {len(all_responses)}")
        
        # Save all captured API responses
        with open("meesho_api_dump.json", "w", encoding="utf-8") as f:
            # Save the URL list
            json.dump([{"url": r["url"], "keys": list(r["data"].keys()) if isinstance(r["data"], dict) else f"list[{len(r['data'])}]"} 
                       for r in all_responses], f, indent=2)
        
        print(f"\n[RESPONSES]:")
        for r in all_responses:
            data = r["data"]
            if isinstance(data, dict):
                print(f"  URL: {r['url'][:100]}")
                print(f"  Keys: {list(data.keys())[:10]}")
                # Look for product-like arrays
                for k, v in data.items():
                    if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                        print(f"    → [{k}] is a list of {len(v)} objects, first item keys: {list(v[0].keys())[:8]}")
                print()
        
        await browser.close()

asyncio.run(test_meesho_api())
