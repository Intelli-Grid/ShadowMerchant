"""
ShadowMerchant — Universal Category Map
Maps the 12 core categories to platform-specific URLs, browse nodes, and keywords.

Usage:
    from category_map import CATEGORY_MAP, get_platform_url, ALL_CATEGORIES

    urls = CATEGORY_MAP["electronics"]["amazon"]  # -> {"browse_node": "...", "keywords": [...]}
"""

from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# 12 Universal Categories + Platform Mappings
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_MAP = {
    "electronics": {
        "amazon": {
            "browse_node": "976419031",
            "url": "https://www.amazon.in/s?bbn=976419031&rh=n%3A976419031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["electronics deals", "mobiles", "laptops", "headphones"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/electronics",
            "category_id": "tyy9ouoHR",
        },
        "myntra": None,  # Myntra has no electronics
        "nykaa": None,   # Nykaa has no electronics
        "meesho": {
            "url": "https://www.meesho.com/search?q=electronics",
        },
        "croma": {
            "url": "https://www.croma.com/sales/best-deals",
        },
    },

    "fashion": {
        "amazon": {
            "browse_node": "1968024031",
            "url": "https://www.amazon.in/s?bbn=1968024031&rh=n%3A1968024031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["fashion deals", "clothing", "shoes", "accessories"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/clothing-accessories",
        },
        "myntra": {
            "url": "https://www.myntra.com/sale",
            "category_urls": [
                "https://www.myntra.com/men-tshirts",
                "https://www.myntra.com/women-dresses",
                "https://www.myntra.com/shoes",
            ],
        },
        "nykaa": {
            "url": "https://www.nykaafashion.com/sp?id=6&root=nav",
        },
        "meesho": {
            "url": "https://www.meesho.com/search?q=fashion",
            "extra_urls": [
                "https://www.meesho.com/search?q=mens clothing",
                "https://www.meesho.com/search?q=sarees",
            ]
        },
        "croma": None,
    },

    "beauty": {
        "amazon": {
            "browse_node": "1355016031",
            "url": "https://www.amazon.in/s?bbn=1355016031&rh=n%3A1355016031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["beauty deals", "skincare", "makeup", "haircare"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/beauty-and-personal-care",
        },
        "myntra": {
            "url": "https://www.myntra.com/beauty",
        },
        "nykaa": {
            "url": "https://www.nykaa.com/beauty/c/3?sort=discount",
            "category_urls": [
                "https://www.nykaa.com/makeup/c/54?sort=discount",
                "https://www.nykaa.com/skin-care/c/53?sort=discount",
                "https://www.nykaa.com/hair-care/c/55?sort=discount",
            ],
        },
        "meesho": {
            "url": "https://www.meesho.com/search?q=beauty",
        },
        "croma": None,
    },

    "home": {
        "amazon": {
            "browse_node": "976460031",
            "url": "https://www.amazon.in/s?bbn=976460031&rh=n%3A976460031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["home appliances deals", "kitchen", "cookware", "furniture"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/home-furniture",
        },
        "myntra": None,
        "nykaa": None,
        "meesho": {
            "url": "https://www.meesho.com/search?q=home decor",
            "extra_urls": ["https://www.meesho.com/search?q=furniture"],
        },
        "croma": {
            "url": "https://www.croma.com/home-appliances",
        },
    },

    "sports": {
        "amazon": {
            "browse_node": "3401137031",
            "url": "https://www.amazon.in/s?bbn=3401137031&rh=n%3A3401137031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["sports deals", "gym equipment", "fitness", "outdoor"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/sports-fitness",
        },
        "myntra": {
            "url": "https://www.myntra.com/sportswear",
        },
        "nykaa": None,
        "meesho": {
            "url": "https://www.meesho.com/search?q=sports",
        },
        "croma": None,
    },

    "books": {
        "amazon": {
            "browse_node": "976389031",
            "url": "https://www.amazon.in/s?bbn=976389031&rh=n%3A976389031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["books deals", "bestseller", "fiction", "non-fiction"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/books",
        },
        "myntra": None,
        "nykaa": None,
        "meesho": None,
        "croma": None,
    },

    "toys": {
        "amazon": {
            "browse_node": "1350400031",
            "url": "https://www.amazon.in/s?bbn=1350400031&rh=n%3A1350400031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["toys deals", "baby", "educational toys", "games"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/toys-and-baby-products",
        },
        "myntra": None,
        "nykaa": None,
        "meesho": {
            "url": "https://www.meesho.com/search?q=kids clothing",
        },
        "croma": None,
    },

    "health": {
        "amazon": {
            "browse_node": "1346257031",
            "url": "https://www.amazon.in/s?bbn=1346257031&rh=n%3A1346257031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["health deals", "vitamins", "supplements", "protein"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/health-care",
        },
        "myntra": None,
        "nykaa": {
            "url": "https://www.nykaa.com/wellness/c/5267?sort=discount",
        },
        "meesho": {
            "url": "https://www.meesho.com/search?q=health wellness",
        },
        "croma": None,
    },

    "automotive": {
        "amazon": {
            "browse_node": "1588778031",
            "url": "https://www.amazon.in/s?bbn=1588778031&rh=n%3A1588778031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["car accessories deals", "automotive tools", "tyre care"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/automotive",
        },
        "myntra": None,
        "nykaa": None,
        "meesho": {
            "url": "https://www.meesho.com/search?q=car bike accessories",
        },
        "croma": None,
    },

    "grocery": {
        "amazon": {
            "browse_node": "2454178031",
            "url": "https://www.amazon.in/s?bbn=2454178031&rh=n%3A2454178031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["grocery deals", "packaged food", "beverages", "organic"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/grocery",
        },
        "myntra": None,
        "nykaa": None,
        "meesho": {
            "url": "https://www.meesho.com/search?q=food grocery",
        },
        "croma": None,
    },

    "travel": {
        "amazon": {
            "browse_node": "1375457031",
            "url": "https://www.amazon.in/s?bbn=1375457031&rh=n%3A1375457031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["luggage deals", "travel bags", "trolleys"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/bags-wallets-and-luggage",
        },
        "myntra": {
            "url": "https://www.myntra.com/luggage-bags",
        },
        "nykaa": None,
        "meesho": {
            "url": "https://www.meesho.com/search?q=travel bags",
        },
        "croma": None,
    },

    "gaming": {
        "amazon": {
            "browse_node": "1388963031",
            "url": "https://www.amazon.in/s?bbn=1388963031&rh=n%3A1388963031%2Cp_n_deal_type%3A31217769031&sort=discount-rank",
            "keywords": ["gaming deals", "console", "PC games", "controllers"],
        },
        "flipkart": {
            "url": "https://www.flipkart.com/offers-list/gaming",
        },
        "myntra": None,
        "nykaa": None,
        "meesho": None,
        "croma": {
            "url": "https://www.croma.com/gaming",
        },
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

ALL_CATEGORIES = list(CATEGORY_MAP.keys())
ALL_PLATFORMS = ["amazon", "flipkart", "myntra", "nykaa", "meesho", "croma"]


def get_platform_config(category: str, platform: str) -> Optional[dict]:
    """Returns the platform config for a given category, or None if not supported."""
    return CATEGORY_MAP.get(category, {}).get(platform)


def get_supported_platforms(category: str) -> list[str]:
    """Returns a list of platforms that support the given category."""
    return [p for p in ALL_PLATFORMS if CATEGORY_MAP.get(category, {}).get(p) is not None]


def get_platform_url(category: str, platform: str) -> Optional[str]:
    """Returns the main deals URL for a category+platform combo."""
    config = get_platform_config(category, platform)
    if isinstance(config, dict):
        return config.get("url")
    return None


if __name__ == "__main__":
    print("=== ShadowMerchant Category Map ===")
    for cat in ALL_CATEGORIES:
        supported = get_supported_platforms(cat)
        print(f"  {cat:<15} → {', '.join(supported)}")
