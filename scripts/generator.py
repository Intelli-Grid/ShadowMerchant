#!/usr/bin/env python3
# scripts/generator.py
import os
import json
import time
import random
import requests
from datetime import datetime
import re
from dotenv import load_dotenv
from prompt_templates import generate_prompt
from social_media import generate_social_media_for_post
from analytics import generate_tracking_link
from seo import optimize_post_seo
from validator import validate_post_content

# Load environment variables from .env file
load_dotenv()

# Set Groq API credentials from environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_BASE = os.getenv("GROQ_API_BASE", "https://api.groq.com/openai/v1")

# Create directories if they don't exist
os.makedirs("../docs/posts", exist_ok=True)
os.makedirs("../docs/data", exist_ok=True)

def sanitize_filename(title):
    """Convert title to a valid filename."""
    # Replace spaces with underscores and remove special characters
    filename = re.sub(r'[^\w\s-]', '', title.lower())
    filename = re.sub(r'[\s]+', '_', filename)
    return filename

def generate_fallback_content(product):
    """
    Generate fallback content when API calls fail.

    Args:
        product (dict): Product information

    Returns:
        str: Generated content
    """
    title = product['title']
    price = product['price']
    source = product['source']

    # Generate a basic review template
    content = f"""
# {title}: A Comprehensive Review

## Introduction

Today, we're taking a closer look at the {title}, currently priced at {price}. This product has been gaining popularity among consumers looking for quality and value in the market.

## Key Features

* High-quality construction for durability
* User-friendly design for ease of use
* Excellent performance compared to similar products
* Attractive design that fits well in any setting
* Great value for the price point

## Pros and Cons

### Pros:
* Reliable performance in various conditions
* Excellent customer reviews on {source}
* Good warranty and customer support
* Competitive pricing

### Cons:
* May not have all premium features of higher-priced alternatives
* Limited color/style options depending on availability
* Shipping times may vary based on location

## Who Is This Product For?

The {title} is perfect for anyone looking for a reliable, cost-effective solution. Whether you're a beginner or experienced user, this product offers the right balance of features and usability.

## Conclusion

Overall, the {title} represents excellent value at its {price} price point. While it may not have every bell and whistle of premium alternatives, it delivers where it counts and should satisfy the needs of most users.
"""

    return content


def generate_affiliate_link(product_link, source="blog", campaign=None, content=None):
    """
    Generate an affiliate link for the product with tracking parameters.

    Args:
        product_link (str): Original product link
        source (str): Traffic source (e.g., blog, twitter, facebook)
        campaign (str, optional): Campaign name
        content (str, optional): Content identifier

    Returns:
        str: Affiliate link with tracking parameters
    """
    # Get affiliate IDs from environment variables
    amazon_affiliate_id = os.getenv("AMAZON_AFFILIATE_ID", "shadowmerch05-21")

    # Add affiliate ID
    if "amazon.com" in product_link:
        # Amazon affiliate link format
        if "?" in product_link:
            affiliate_link = f"{product_link}&tag={amazon_affiliate_id}"
        else:
            affiliate_link = f"{product_link}?tag={amazon_affiliate_id}"
    else:
        # Generic affiliate link (no modification for non-Amazon links)
        affiliate_link = product_link

    # Add tracking parameters
    return generate_tracking_link(affiliate_link, source, campaign, content)

def generate_blog_post(product, include_affiliate_disclosure=True, content_length="medium"):
    """
    Generate a blog post about a product using AI.

    Args:
        product (dict): Product information
        include_affiliate_disclosure (bool): Whether to include affiliate disclosure
        content_length (str): Length of content to generate (short, medium, long)

    Returns:
        str: Generated blog post content
    """
    try:
        # Determine category from product source or title
        category = None
        if 'source' in product:
            if product['source'].lower() == 'amazon':
                # Try to infer category from title
                title_lower = product['title'].lower()
                if any(keyword in title_lower for keyword in ['headphone', 'earbud', 'speaker', 'watch', 'laptop', 'phone', 'camera', 'monitor']):
                    category = 'tech'
                elif any(keyword in title_lower for keyword in ['chair', 'desk', 'furniture', 'kitchen', 'home']):
                    category = 'home'
            elif product['source'].lower() == 'clickbank':
                # Most ClickBank products are digital or fitness related
                title_lower = product['title'].lower()
                if any(keyword in title_lower for keyword in ['diet', 'fitness', 'weight', 'health', 'yoga']):
                    category = 'fitness'
                else:
                    category = 'digital'

        # Generate specialized prompt based on product category
        prompt = generate_prompt(product, category)

        # Adjust token count based on content length
        max_tokens = {
            "short": 750,
            "medium": 1200,
            "long": 2000
        }.get(content_length, 1200)

        try:
            # Generate content using Groq API
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": "llama3-8b-8192",  # Using Llama 3 8B model
                "messages": [
                    {"role": "system", "content": "You are a professional product reviewer who writes engaging, detailed, and SEO-optimized content."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": max_tokens,
                "temperature": 0.7
            }

            response = requests.post(
                f"{GROQ_API_BASE}/chat/completions",
                headers=headers,
                json=payload
            )

            # Check if the request was successful
            response.raise_for_status()

            # Extract the generated content
            response_json = response.json()
            content = response_json["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"Error with Groq API: {e}")
            print("Using fallback content generation method...")
            # Generate fallback content based on product information
            content = generate_fallback_content(product)

        # Generate an affiliate link
        affiliate_link = generate_affiliate_link(product['link'])

        # Add affiliate link to the content
        content += f"\n\n[Check Price and Reviews on {product['source']}]({affiliate_link})\n"

        # Add affiliate disclosure if requested
        if include_affiliate_disclosure:
            disclosure = """

            ---

            *Disclosure: As an Amazon Associate, I earn from qualifying purchases. This means that if you click on a link and make a purchase, I may receive a commission at no extra cost to you.*
            """
            content += disclosure

        return content

    except Exception as e:
        print(f"Error generating blog post: {e}")
        return None

def save_blog_post(product, content, generate_social=True, optimize_seo=True, validate_content=True):
    """
    Save the generated blog post to a file and optionally generate social media posts.

    Args:
        product (dict): Product information
        content (str): Blog post content
        generate_social (bool): Whether to generate social media posts
        optimize_seo (bool): Whether to optimize SEO
        validate_content (bool): Whether to validate content quality

    Returns:
        str: Path to the saved file
    """
    try:
        # Create a filename from the product title
        filename = sanitize_filename(product['title'])
        date_str = datetime.now().strftime("%Y-%m-%d")
        filepath = f"../docs/posts/{date_str}_{filename}.md"

        # Create front matter for the blog post
        front_matter = f"""---
title: "Review: {product['title']}"
date: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
categories: [reviews, {product['source'].lower()}]
tags: [product review, {' '.join(product['title'].lower().split()[:3])}]
image: {product.get('image', '')}
---

"""

        # Combine front matter and content
        full_content = front_matter + content

        # Save to file
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(full_content)

        print(f"Blog post saved to {filepath}")

        # Update the posts index
        post_data = update_posts_index(product, filepath)

        # Generate social media posts if requested
        if generate_social and post_data:
            print(f"Generating social media posts for {product['title']}")
            generate_social_media_for_post(post_data, product)

        # Optimize SEO if requested
        if optimize_seo and post_data:
            print(f"Optimizing SEO for {product['title']}")
            optimize_post_seo(post_data)

        # Validate content if requested
        if validate_content and post_data:
            print(f"Validating content for {product['title']}")
            validation_results = validate_post_content(post_data)

            # Check for low quality content
            if validation_results.get('quality_check', {}).get('overall_score', 0) < 60:
                print(f"WARNING: Low quality content detected for {product['title']}")
                print(f"Quality score: {validation_results.get('quality_check', {}).get('overall_score', 0)}")
                print(f"Issues: {validation_results.get('quality_check', {}).get('issues', [])}")

            # Check for plagiarism risk
            if validation_results.get('plagiarism_check', {}).get('plagiarism_risk', '') == 'high':
                print(f"WARNING: High plagiarism risk detected for {product['title']}")
                print(f"Explanation: {validation_results.get('plagiarism_check', {}).get('explanation', '')}")

        return filepath

    except Exception as e:
        print(f"Error saving blog post: {e}")
        return None

def update_posts_index(product, filepath):
    """
    Update the index of generated posts.

    Args:
        product (dict): Product information
        filepath (str): Path to the saved blog post

    Returns:
        dict: Post entry data or None if error
    """
    try:
        index_path = "../docs/data/posts_index.json"

        # Create post entry
        post_entry = {
            "title": product['title'],
            "source": product['source'],
            "price": product['price'],
            "filepath": filepath,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "product_link": product['link']
        }

        # Load existing index if it exists
        if os.path.exists(index_path):
            try:
                with open(index_path, "r") as f:
                    posts_index = json.load(f)
            except json.JSONDecodeError:
                posts_index = []
        else:
            posts_index = []

        # Add new post to index
        posts_index.append(post_entry)

        # Save updated index
        with open(index_path, "w") as f:
            json.dump(posts_index, f, indent=2)

        return post_entry

    except Exception as e:
        print(f"Error updating posts index: {e}")
        return None

def generate_posts_from_products(max_posts=5, content_length="medium", prioritize_categories=None, generate_social=True, optimize_seo=True, validate_content=True):
    """
    Generate blog posts from scraped products.

    Args:
        max_posts (int): Maximum number of posts to generate
        content_length (str): Length of content to generate (short, medium, long)
        prioritize_categories (list): List of product categories to prioritize
        generate_social (bool): Whether to generate social media posts
        optimize_seo (bool): Whether to optimize SEO
        validate_content (bool): Whether to validate content quality

    Returns:
        int: Number of posts generated
    """
    try:
        # Load Amazon products
        amazon_path = "../docs/data/products.json"
        if os.path.exists(amazon_path):
            with open(amazon_path, "r") as f:
                amazon_products = json.load(f)
        else:
            amazon_products = []

        # Use only Amazon products
        all_products = amazon_products

        # Shuffle products to get a mix
        random.shuffle(all_products)

        # Load existing posts index to avoid duplicates
        index_path = "../docs/data/posts_index.json"
        if os.path.exists(index_path):
            with open(index_path, "r") as f:
                posts_index = json.load(f)

            # Extract titles of existing posts
            existing_titles = [post['title'] for post in posts_index]
        else:
            existing_titles = []

        # Filter out products that already have posts
        new_products = [p for p in all_products if p['title'] not in existing_titles]

        # Apply category prioritization if specified
        if prioritize_categories:
            # Define a function to determine if a product matches prioritized categories
            def matches_priority(product):
                title_lower = product['title'].lower()
                for category in prioritize_categories:
                    category_lower = category.lower()
                    if category_lower == 'tech' and any(keyword in title_lower for keyword in ['headphone', 'earbud', 'speaker', 'watch', 'laptop', 'phone', 'camera', 'monitor']):
                        return True
                    elif category_lower == 'home' and any(keyword in title_lower for keyword in ['chair', 'desk', 'furniture', 'kitchen', 'home']):
                        return True
                    elif category_lower == 'fitness' and any(keyword in title_lower for keyword in ['diet', 'fitness', 'weight', 'health', 'yoga']):
                        return True
                    elif category_lower == 'digital' and any(keyword in title_lower for keyword in ['course', 'ebook', 'program', 'guide', 'plan']):
                        return True
                return False

            # Sort products to prioritize specified categories
            priority_products = [p for p in new_products if matches_priority(p)]
            other_products = [p for p in new_products if p not in priority_products]
            sorted_products = priority_products + other_products
        else:
            sorted_products = new_products

        # Generate posts for new products
        posts_generated = 0
        for product in sorted_products[:max_posts]:
            print(f"Generating post for: {product['title']}")

            # Generate blog post content with specified length
            content = generate_blog_post(product, content_length=content_length)

            if content:
                # Save the blog post with the specified options
                save_blog_post(
                    product,
                    content,
                    generate_social=generate_social,
                    optimize_seo=optimize_seo,
                    validate_content=validate_content
                )
                posts_generated += 1

                # Respect rate limits for API calls
                time.sleep(2)

        print(f"Generated {posts_generated} new blog posts")
        return posts_generated

    except Exception as e:
        print(f"Error generating posts from products: {e}")
        return 0

if __name__ == "__main__":
    import argparse

    # Set up command line arguments
    parser = argparse.ArgumentParser(description='Generate affiliate blog posts from product data')
    parser.add_argument('--max-posts', type=int, default=3, help='Maximum number of posts to generate')
    parser.add_argument('--content-length', choices=['short', 'medium', 'long'], default='medium',
                        help='Length of content to generate')
    parser.add_argument('--prioritize', nargs='+', choices=['tech', 'home', 'fitness', 'digital'],
                        help='Product categories to prioritize')
    parser.add_argument('--no-social', action='store_true', help='Disable social media post generation')
    parser.add_argument('--no-seo', action='store_true', help='Disable SEO optimization')
    parser.add_argument('--no-validation', action='store_true', help='Disable content validation')

    args = parser.parse_args()

    # Generate blog posts from scraped products with the new parameters
    generate_posts_from_products(
        max_posts=args.max_posts,
        content_length=args.content_length,
        prioritize_categories=args.prioritize,
        generate_social=not args.no_social,
        optimize_seo=not args.no_seo,
        validate_content=not args.no_validation
    )
