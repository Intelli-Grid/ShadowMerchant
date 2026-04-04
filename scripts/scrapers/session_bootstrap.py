"""
Shared session bootstrap utility.
Launches a stealth browser to harvest valid cookies + headers from a target domain,
then returns them for use in httpx/requests API calls.
"""
import logging
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)


async def _bootstrap_async(seed_url: str, wait_ms: int = 3000) -> tuple[dict, dict]:
    """Internal async bootstrap."""
    from playwright.async_api import async_playwright

    # Graceful stealth import — works without playwright_stealth installed
    try:
        from playwright_stealth import stealth_async
        use_stealth = True
    except (ImportError, Exception):
        use_stealth = False
        async def stealth_async(page):
            await page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                window.chrome = { runtime: {} };
                Object.defineProperty(navigator, 'languages', {get: () => ['en-IN', 'en']});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3]});
            """)


    cookies_dict: dict = {}
    headers_dict: dict = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            viewport={"width": 1366, "height": 768},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        if use_stealth:
            await stealth_async(page)

        await page.goto(seed_url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(wait_ms)

        # Harvest cookies
        for c in await context.cookies():
            cookies_dict[c["name"]] = c["value"]

        # Default headers that mimic a real browser session
        headers_dict = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-IN,en;q=0.9",
            "Referer": seed_url,
            "Origin": "/".join(seed_url.split("/")[:3]),
        }

        await browser.close()

    logger.info(f"Bootstrap ({seed_url[:40]}): {len(cookies_dict)} cookies")
    return cookies_dict, headers_dict


def get_session(seed_url: str, wait_ms: int = 3000) -> tuple[dict, dict]:
    """
    Synchronous wrapper. Returns (cookies_dict, headers_dict).
    Safe to call from any context — creates its own isolated event loop.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_bootstrap_async(seed_url, wait_ms))
    finally:
        loop.close()
