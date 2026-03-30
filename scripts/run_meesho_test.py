import sys, os, logging
from pathlib import Path

# Ensure scripts/ is on the path
sys.path.insert(0, str(Path(__file__).parent))

os.chdir(Path(__file__).parent)

logging.basicConfig(level=logging.INFO)

from scrapers.meesho_scraper import MeeshoScraper

try:
    s = MeeshoScraper()
    results = s.scrape_deals()
    print(f"\n{'='*50}")
    print(f"TOTAL DEALS: {len(results)}")
    print('='*50)
    by_cat = {}
    for r in results:
        by_cat.setdefault(r.category, []).append(r)
    for cat, deals in sorted(by_cat.items()):
        print(f"  [{cat}]: {len(deals)} deals")
    print()
    for r in results[:6]:
        print(f"[{r.category}] {r.title[:55]}")
        print(f"  Price: Rs.{r.discounted_price} | Discount: {r.discount_percent}%")
        print(f"  URL:   {r.product_url[:80]}")
        print(f"  IMG:   {r.image_url[:80]}")
        print()
except Exception as e:
    import traceback
    traceback.print_exc()
