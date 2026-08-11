"""
slug_generator.py
=================
Generates SEO-friendly URL slugs for ShadowMerchant deals.

Format: {title-words}-{discount}pct-off-{platform}
Example: samsung-65-qled-4k-tv-68pct-off-amazon

Rules:
- Lowercase, hyphens only
- Strip special chars, compress whitespace
- Truncate title portion to 60 chars max
- Append discount + platform for uniqueness + keyword signal
- Truncate total slug to 100 chars

Usage:
    from scripts.utils.slug_generator import make_deal_slug
    slug = make_deal_slug("Samsung 65\" QLED 4K TV", 68, "amazon")
    # -> "samsung-65-qled-4k-tv-68pct-off-amazon"
"""

import re


def make_deal_slug(title: str, discount_percent: float, platform: str) -> str:
    """
    Generate a URL slug for a deal.
    
    Args:
        title: Product title (any length, any chars)
        discount_percent: Numeric discount (e.g. 68.3 -> "68pct")
        platform: Source platform slug (amazon, flipkart, etc.)
    
    Returns:
        URL-safe slug string, max 100 chars
    """
    # 1. Lowercase
    slug = title.lower()
    
    # 2. Replace common symbols that have text equivalents
    slug = slug.replace('"', 'inch').replace("'", '').replace('&', 'and')
    slug = slug.replace('%', 'pct').replace('+', 'plus').replace('@', 'at')
    
    # 3. Remove all non-alphanumeric chars except spaces and hyphens
    slug = re.sub(r'[^a-z0-9\s\-]', '', slug)
    
    # 4. Collapse whitespace + hyphens
    slug = re.sub(r'[\s\-]+', '-', slug).strip('-')
    
    # 5. Truncate title portion to 60 chars (cut at word boundary)
    if len(slug) > 60:
        slug = slug[:60].rsplit('-', 1)[0]
    
    # 6. Append discount + platform suffix
    pct = round(discount_percent)
    platform_clean = re.sub(r'[^a-z0-9]', '', platform.lower())
    suffix = f"{pct}pct-off-{platform_clean}"
    
    full_slug = f"{slug}-{suffix}"
    
    # 7. Final truncation to 100 chars (cut at word boundary)
    if len(full_slug) > 100:
        full_slug = full_slug[:100].rsplit('-', 1)[0]
    
    return full_slug


def make_unique_slug(base_slug: str, existing_slugs: set) -> str:
    """
    If base_slug already exists, append a numeric suffix until unique.
    
    Args:
        base_slug: Generated slug
        existing_slugs: Set of already-taken slugs (from DB query)
    
    Returns:
        Unique slug (base_slug, base_slug-2, base_slug-3, ...)
    """
    if base_slug not in existing_slugs:
        return base_slug
    
    counter = 2
    while f"{base_slug}-{counter}" in existing_slugs:
        counter += 1
    return f"{base_slug}-{counter}"
