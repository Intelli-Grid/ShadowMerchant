#!/usr/bin/env python3
# scripts/scraper.py
import requests
from bs4 import BeautifulSoup
import json
import os
import time
import random
from datetime import datetime

# Create directories if they don't exist
os.makedirs("../docs/data", exist_ok=True)

# List of user agents to rotate
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36"
]

def get_random_user_agent():
    """Return a random user agent from the list."""
    return random.choice(USER_AGENTS)

def scrape_amazon(query, max_products=10):
    """
    Scrape Amazon for products based on the query.

    Args:
        query (str): Search query for Amazon
        max_products (int): Maximum number of products to scrape

    Returns:
        list: List of product dictionaries
    """
    url = f"https://www.amazon.com/s?k={query.replace(' ', '+')}"
    headers = {"User-Agent": get_random_user_agent()}

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise an exception for HTTP errors

        soup = BeautifulSoup(response.text, "html.parser")
        products = []

        # Find product elements
        items = soup.select(".s-result-item[data-component-type='s-search-result']")

        for item in items[:max_products]:
            try:
                # Extract product details
                title_elem = item.select_one("h2 a span")
                price_elem = item.select_one(".a-price .a-offscreen")
                link_elem = item.select_one("h2 a")
                image_elem = item.select_one("img.s-image")

                if not all([title_elem, link_elem]):
                    continue

                title = title_elem.text.strip()
                price = price_elem.text.strip() if price_elem else "Price not available"
                link = "https://www.amazon.com" + link_elem.get("href") if link_elem else ""
                image = image_elem.get("src") if image_elem else ""

                # Create product dictionary
                product = {
                    "title": title,
                    "price": price,
                    "link": link,
                    "image": image,
                    "source": "Amazon",
                    "scraped_date": datetime.now().strftime("%Y-%m-%d")
                }

                products.append(product)

                # Respect rate limits
                time.sleep(1)

            except Exception as e:
                print(f"Error extracting product: {e}")
                continue

        # Save products to JSON file
        output_path = "../docs/data/products.json"

        # Check if file exists and load existing data
        if os.path.exists(output_path):
            try:
                with open(output_path, "r") as f:
                    existing_data = json.load(f)
                # Append new products to existing data
                products = existing_data + products
            except json.JSONDecodeError:
                # If file is empty or invalid JSON, use only new products
                pass

        # Save updated products list
        with open(output_path, "w") as f:
            json.dump(products, f, indent=2)

        print(f"Successfully scraped {len(products)} products from Amazon")
        return products

    except Exception as e:
        print(f"Error scraping Amazon: {e}")
        return []

def scrape_clickbank(category="health_and_fitness", max_products=10):
    """
    Scrape ClickBank marketplace for affiliate products.

    Args:
        category (str): Category to scrape on ClickBank
        max_products (int): Maximum number of products to scrape

    Returns:
        list: List of product dictionaries
    """
    url = f"https://www.clickbank.com/browse/{category}/"
    headers = {"User-Agent": get_random_user_agent()}

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        products = []

        # Find product elements (adjust selectors based on ClickBank's actual structure)
        items = soup.select(".product-item")

        for item in items[:max_products]:
            try:
                # Extract product details (adjust selectors as needed)
                title_elem = item.select_one(".product-title")
                price_elem = item.select_one(".product-price")
                link_elem = item.select_one("a.product-link")

                if not all([title_elem, link_elem]):
                    continue

                title = title_elem.text.strip()
                price = price_elem.text.strip() if price_elem else "Price not available"
                link = link_elem.get("href") if link_elem else ""

                # Create product dictionary
                product = {
                    "title": title,
                    "price": price,
                    "link": link,
                    "source": "ClickBank",
                    "scraped_date": datetime.now().strftime("%Y-%m-%d")
                }

                products.append(product)

                # Respect rate limits
                time.sleep(1)

            except Exception as e:
                print(f"Error extracting ClickBank product: {e}")
                continue

        # Save products to JSON file
        output_path = "../docs/data/clickbank_products.json"

        # Check if file exists and load existing data
        if os.path.exists(output_path):
            try:
                with open(output_path, "r") as f:
                    existing_data = json.load(f)
                # Append new products to existing data
                products = existing_data + products
            except json.JSONDecodeError:
                # If file is empty or invalid JSON, use only new products
                pass

        # Save updated products list
        with open(output_path, "w") as f:
            json.dump(products, f, indent=2)

        print(f"Successfully scraped {len(products)} products from ClickBank")
        return products

    except Exception as e:
        print(f"Error scraping ClickBank: {e}")
        return []

if __name__ == "__main__":
    # Define search queries
    search_queries = [
        "best gadgets 2023",
        "home office essentials",
        "fitness equipment",
        "kitchen gadgets",
        "tech accessories",
        "smart home devices",
        "wireless earbuds",
        "laptop accessories"
    ]

    # Scrape Amazon for each query
    all_products = []
    for query in search_queries:
        print(f"Scraping Amazon for: {query}")
        products = scrape_amazon(query)
        all_products.extend(products)
        # Respect rate limits between queries
        time.sleep(5)

    print(f"Total Amazon products scraped: {len(all_products)}")
