#!/usr/bin/env python3
# scripts/analytics.py

"""
This module handles analytics tracking for affiliate links.
It generates tracking links with UTM parameters and tracks clicks and conversions.
"""

import os
import json
import time
import random
from datetime import datetime, timedelta
import re
import urllib.parse
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def generate_tracking_link(product_link, source, campaign=None, content=None):
    """
    Generate a tracking link with UTM parameters.

    Args:
        product_link (str): Original product link
        source (str): Traffic source (e.g., blog, twitter, facebook)
        campaign (str, optional): Campaign name
        content (str, optional): Content identifier

    Returns:
        str: Tracking link with UTM parameters
    """
    # Parse the URL
    parsed_url = urllib.parse.urlparse(product_link)

    # Get existing query parameters
    query_params = urllib.parse.parse_qs(parsed_url.query)

    # Add UTM parameters
    query_params['utm_source'] = [source]
    query_params['utm_medium'] = ['affiliate']

    if campaign:
        query_params['utm_campaign'] = [campaign]

    if content:
        query_params['utm_content'] = [content]

    # Build the new query string
    new_query = urllib.parse.urlencode(query_params, doseq=True)

    # Construct the new URL
    tracking_link = urllib.parse.urlunparse((
        parsed_url.scheme,
        parsed_url.netloc,
        parsed_url.path,
        parsed_url.params,
        new_query,
        parsed_url.fragment
    ))

    return tracking_link

def record_link_click(product_id, source, campaign=None):
    """
    Record a click on an affiliate link.

    Args:
        product_id (str): Product identifier
        source (str): Traffic source
        campaign (str, optional): Campaign name

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data/analytics', exist_ok=True)

        # Load existing clicks if file exists
        clicks_path = '../docs/data/analytics/clicks.json'
        if os.path.exists(clicks_path):
            with open(clicks_path, 'r', encoding='utf-8') as f:
                clicks_data = json.load(f)
        else:
            clicks_data = []

        # Create click entry
        click_entry = {
            'product_id': product_id,
            'source': source,
            'campaign': campaign,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        # Add to clicks data
        clicks_data.append(click_entry)

        # Save updated clicks data
        with open(clicks_path, 'w', encoding='utf-8') as f:
            json.dump(clicks_data, f, indent=2)

        return True

    except Exception as e:
        print(f"Error recording link click: {e}")
        return False

def record_conversion(product_id, source, amount, campaign=None):
    """
    Record a conversion (purchase).

    Args:
        product_id (str): Product identifier
        source (str): Traffic source
        amount (float): Purchase amount
        campaign (str, optional): Campaign name

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data/analytics', exist_ok=True)

        # Load existing conversions if file exists
        conversions_path = '../docs/data/analytics/conversions.json'
        if os.path.exists(conversions_path):
            with open(conversions_path, 'r', encoding='utf-8') as f:
                conversions_data = json.load(f)
        else:
            conversions_data = []

        # Create conversion entry
        conversion_entry = {
            'product_id': product_id,
            'source': source,
            'campaign': campaign,
            'amount': amount,
            'commission': calculate_commission(product_id, amount),
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        # Add to conversions data
        conversions_data.append(conversion_entry)

        # Save updated conversions data
        with open(conversions_path, 'w', encoding='utf-8') as f:
            json.dump(conversions_data, f, indent=2)

        # Update earnings summary
        update_earnings_summary()

        return True

    except Exception as e:
        print(f"Error recording conversion: {e}")
        return False

def calculate_commission(product_id, amount):
    """
    Calculate commission for a product purchase.

    Args:
        product_id (str): Product identifier
        amount (float): Purchase amount

    Returns:
        float: Commission amount
    """
    # Amazon commission rate (3%)
    commission_rate = 0.03

    # Calculate commission
    commission = amount * commission_rate

    return round(commission, 2)

def update_earnings_summary():
    """
    Update the earnings summary file with aggregated data.

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data/analytics', exist_ok=True)

        # Load conversions data
        conversions_path = '../docs/data/analytics/conversions.json'
        if not os.path.exists(conversions_path):
            # No conversions yet
            return False

        with open(conversions_path, 'r', encoding='utf-8') as f:
            conversions_data = json.load(f)

        # Initialize summary data
        summary = {
            'total_earnings': 0,
            'total_sales': 0,
            'by_source': {},
            'by_product': {},
            'by_date': {},
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        # Process each conversion
        for conversion in conversions_data:
            # Update totals
            summary['total_earnings'] += conversion['commission']
            summary['total_sales'] += conversion['amount']

            # Update by source
            source = conversion['source']
            if source not in summary['by_source']:
                summary['by_source'][source] = {
                    'earnings': 0,
                    'sales': 0,
                    'conversions': 0
                }
            summary['by_source'][source]['earnings'] += conversion['commission']
            summary['by_source'][source]['sales'] += conversion['amount']
            summary['by_source'][source]['conversions'] += 1

            # Update by product
            product_id = conversion['product_id']
            if product_id not in summary['by_product']:
                summary['by_product'][product_id] = {
                    'earnings': 0,
                    'sales': 0,
                    'conversions': 0
                }
            summary['by_product'][product_id]['earnings'] += conversion['commission']
            summary['by_product'][product_id]['sales'] += conversion['amount']
            summary['by_product'][product_id]['conversions'] += 1

            # Update by date (use date part of timestamp)
            date = conversion['timestamp'].split()[0]
            if date not in summary['by_date']:
                summary['by_date'][date] = {
                    'earnings': 0,
                    'sales': 0,
                    'conversions': 0
                }
            summary['by_date'][date]['earnings'] += conversion['commission']
            summary['by_date'][date]['sales'] += conversion['amount']
            summary['by_date'][date]['conversions'] += 1

        # Round all monetary values to 2 decimal places
        summary['total_earnings'] = round(summary['total_earnings'], 2)
        summary['total_sales'] = round(summary['total_sales'], 2)

        for source in summary['by_source']:
            summary['by_source'][source]['earnings'] = round(summary['by_source'][source]['earnings'], 2)
            summary['by_source'][source]['sales'] = round(summary['by_source'][source]['sales'], 2)

        for product_id in summary['by_product']:
            summary['by_product'][product_id]['earnings'] = round(summary['by_product'][product_id]['earnings'], 2)
            summary['by_product'][product_id]['sales'] = round(summary['by_product'][product_id]['sales'], 2)

        for date in summary['by_date']:
            summary['by_date'][date]['earnings'] = round(summary['by_date'][date]['earnings'], 2)
            summary['by_date'][date]['sales'] = round(summary['by_date'][date]['sales'], 2)

        # Save summary data
        summary_path = '../docs/data/analytics/earnings_summary.json'
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        return True

    except Exception as e:
        print(f"Error updating earnings summary: {e}")
        return False

def generate_sample_data(num_clicks=50, num_conversions=10):
    """
    Generate sample analytics data for testing.

    Args:
        num_clicks (int): Number of clicks to generate
        num_conversions (int): Number of conversions to generate

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data/analytics', exist_ok=True)

        # Sample products (Amazon only)
        products = [
            {'id': 'amazon_wireless_earbuds', 'name': 'Wireless Bluetooth Earbuds', 'price': 49.99},
            {'id': 'amazon_smart_watch', 'name': 'Smart Watch with Heart Rate Monitor', 'price': 89.95},
            {'id': 'amazon_bluetooth_speaker', 'name': 'Portable Bluetooth Speaker', 'price': 35.99},
            {'id': 'amazon_laptop_stand', 'name': 'Adjustable Laptop Stand', 'price': 29.99},
            {'id': 'amazon_mechanical_keyboard', 'name': 'Mechanical Gaming Keyboard', 'price': 59.99}
        ]

        # Sample sources
        sources = ['blog', 'twitter', 'facebook', 'email', 'direct']

        # Sample campaigns
        campaigns = ['summer_sale', 'black_friday', 'new_year', None]

        # Generate clicks
        clicks_data = []
        for _ in range(num_clicks):
            product = random.choice(products)
            source = random.choice(sources)
            campaign = random.choice(campaigns)

            # Generate a random timestamp within the last 30 days
            days_ago = random.randint(0, 30)
            timestamp = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d %H:%M:%S')

            click_entry = {
                'product_id': product['id'],
                'source': source,
                'campaign': campaign,
                'timestamp': timestamp
            }

            clicks_data.append(click_entry)

        # Save clicks data
        clicks_path = '../docs/data/analytics/clicks.json'
        with open(clicks_path, 'w', encoding='utf-8') as f:
            json.dump(clicks_data, f, indent=2)

        # Generate conversions (subset of clicks)
        conversions_data = []
        for _ in range(num_conversions):
            # Use a click as the basis for a conversion
            click = random.choice(clicks_data)

            # Find the corresponding product
            product = next((p for p in products if p['id'] == click['product_id']), None)
            if not product:
                continue

            # Generate a random timestamp after the click
            click_time = datetime.strptime(click['timestamp'], '%Y-%m-%d %H:%M:%S')
            hours_later = random.randint(1, 24)
            conversion_time = (click_time + timedelta(hours=hours_later)).strftime('%Y-%m-%d %H:%M:%S')

            # Calculate commission
            amount = product['price']
            commission = calculate_commission(product['id'], amount)

            conversion_entry = {
                'product_id': click['product_id'],
                'source': click['source'],
                'campaign': click['campaign'],
                'amount': amount,
                'commission': commission,
                'timestamp': conversion_time
            }

            conversions_data.append(conversion_entry)

        # Save conversions data
        conversions_path = '../docs/data/analytics/conversions.json'
        with open(conversions_path, 'w', encoding='utf-8') as f:
            json.dump(conversions_data, f, indent=2)

        # Update earnings summary
        update_earnings_summary()

        return True

    except Exception as e:
        print(f"Error generating sample data: {e}")
        return False

if __name__ == "__main__":
    # Generate sample data for testing
    generate_sample_data(num_clicks=100, num_conversions=20)
    print("Sample analytics data generated successfully!")
