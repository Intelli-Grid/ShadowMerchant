#!/usr/bin/env python3
# scripts/social_media.py

"""
This module handles social media post generation and scheduling.
It creates social media content based on blog posts and can schedule them for posting.
"""

import os
import json
import time
import random
from datetime import datetime, timedelta
import re
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def extract_post_highlights(content, max_highlights=3):
    """
    Extract key highlights from a blog post for social media sharing.
    
    Args:
        content (str): Blog post content
        max_highlights (int): Maximum number of highlights to extract
        
    Returns:
        list: List of highlights
    """
    # Extract headings (H2 and H3)
    heading_pattern = r'##\s+(.*?)(?=\n|$)'
    headings = re.findall(heading_pattern, content)
    
    # Extract bullet points
    bullet_pattern = r'\*\s+(.*?)(?=\n|$)'
    bullets = re.findall(bullet_pattern, content)
    
    # Extract sentences with "best", "top", "great", etc.
    highlight_pattern = r'([^.\n]*(?:best|top|great|excellent|perfect|ideal|recommended)[^.\n]*\.)'
    highlights = re.findall(highlight_pattern, content, re.IGNORECASE)
    
    # Combine and prioritize
    all_highlights = []
    
    # Add headings first (they're usually good highlights)
    all_highlights.extend(headings[:2])
    
    # Add strong highlight sentences
    all_highlights.extend(highlights[:2])
    
    # Add bullet points
    all_highlights.extend(bullets[:3])
    
    # Deduplicate and limit
    unique_highlights = []
    for highlight in all_highlights:
        # Clean up the highlight
        clean_highlight = highlight.strip()
        if clean_highlight and clean_highlight not in unique_highlights:
            unique_highlights.append(clean_highlight)
            if len(unique_highlights) >= max_highlights:
                break
    
    return unique_highlights

def generate_twitter_post(post_data, product_data, include_link=True):
    """
    Generate a Twitter post for a blog post.
    
    Args:
        post_data (dict): Blog post data
        product_data (dict): Product data
        include_link (bool): Whether to include a link to the blog post
        
    Returns:
        str: Twitter post content
    """
    # Get post title and extract product name
    title = post_data['title']
    product_name = product_data['title']
    price = product_data['price']
    
    # Load post content
    try:
        with open(post_data['filepath'], 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading post content: {e}")
        content = ""
    
    # Extract highlights
    highlights = extract_post_highlights(content, max_highlights=1)
    highlight = highlights[0] if highlights else ""
    
    # Create tweet variations
    tweet_templates = [
        f"🔥 Just reviewed the {product_name}! {highlight} Check out our full review to see if it's worth the {price}.",
        f"Looking for a new {product_name.split()[0]}? Our latest review breaks down everything you need to know before buying!",
        f"Is the {product_name} worth your money? 💰 We tested it so you don't have to! Read our honest review.",
        f"NEW REVIEW: {title} - Find out why this might be your next must-have purchase!",
    ]
    
    # Select a random template
    tweet = random.choice(tweet_templates)
    
    # Add link if requested
    if include_link:
        tweet += f" {product_data['link']}"
    
    # Ensure tweet is under 280 characters
    if len(tweet) > 280:
        # Truncate and add ellipsis
        tweet = tweet[:276] + "..."
    
    return tweet

def generate_facebook_post(post_data, product_data):
    """
    Generate a Facebook post for a blog post.
    
    Args:
        post_data (dict): Blog post data
        product_data (dict): Product data
        
    Returns:
        str: Facebook post content
    """
    # Get post title and extract product name
    title = post_data['title']
    product_name = product_data['title']
    price = product_data['price']
    
    # Load post content
    try:
        with open(post_data['filepath'], 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading post content: {e}")
        content = ""
    
    # Extract highlights
    highlights = extract_post_highlights(content, max_highlights=3)
    
    # Create Facebook post
    post = f"📢 NEW PRODUCT REVIEW: {title} 📢\n\n"
    post += f"We've just published our in-depth review of the {product_name}, currently priced at {price}.\n\n"
    
    if highlights:
        post += "Here's what you need to know:\n\n"
        for highlight in highlights:
            post += f"✅ {highlight}\n"
    
    post += f"\nIs it worth your money? Click the link below to read our full review and find out!\n\n"
    post += f"👉 {product_data['link']}\n\n"
    post += f"#ProductReview #{product_name.split()[0].replace('-', '')} #HonestReviews"
    
    return post

def generate_social_media_schedule(post_data, product_data, platforms=['twitter', 'facebook']):
    """
    Generate a social media posting schedule for a blog post.
    
    Args:
        post_data (dict): Blog post data
        product_data (dict): Product data
        platforms (list): List of social media platforms
        
    Returns:
        list: List of scheduled social media posts
    """
    # Get current date
    now = datetime.now()
    
    # Create schedule
    schedule = []
    
    # Initial posts (day of publication)
    for platform in platforms:
        if platform.lower() == 'twitter':
            content = generate_twitter_post(post_data, product_data)
        elif platform.lower() == 'facebook':
            content = generate_facebook_post(post_data, product_data)
        else:
            continue
        
        schedule.append({
            'platform': platform,
            'content': content,
            'scheduled_time': (now + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S'),
            'post_id': post_data['title'],
            'status': 'scheduled'
        })
    
    # Follow-up posts (3 days later)
    for platform in platforms:
        if platform.lower() == 'twitter':
            content = generate_twitter_post(post_data, product_data)
            content = content.replace("Just reviewed", "In case you missed our review of")
        elif platform.lower() == 'facebook':
            content = generate_facebook_post(post_data, product_data)
            content = content.replace("NEW PRODUCT REVIEW", "IN CASE YOU MISSED IT")
        else:
            continue
        
        schedule.append({
            'platform': platform,
            'content': content,
            'scheduled_time': (now + timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S'),
            'post_id': post_data['title'],
            'status': 'scheduled'
        })
    
    return schedule

def save_social_media_schedule(schedule):
    """
    Save social media schedule to a JSON file.
    
    Args:
        schedule (list): List of scheduled social media posts
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data', exist_ok=True)
        
        # Load existing schedule if it exists
        schedule_path = '../docs/data/social_media_schedule.json'
        if os.path.exists(schedule_path):
            with open(schedule_path, 'r', encoding='utf-8') as f:
                existing_schedule = json.load(f)
        else:
            existing_schedule = []
        
        # Add new schedule items
        existing_schedule.extend(schedule)
        
        # Save updated schedule
        with open(schedule_path, 'w', encoding='utf-8') as f:
            json.dump(existing_schedule, f, indent=2)
        
        print(f"Saved {len(schedule)} social media posts to schedule")
        return True
    
    except Exception as e:
        print(f"Error saving social media schedule: {e}")
        return False

def generate_social_media_for_post(post_data, product_data):
    """
    Generate social media posts for a blog post and save the schedule.
    
    Args:
        post_data (dict): Blog post data
        product_data (dict): Product data
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Generate schedule
        schedule = generate_social_media_schedule(post_data, product_data)
        
        # Save schedule
        return save_social_media_schedule(schedule)
    
    except Exception as e:
        print(f"Error generating social media for post: {e}")
        return False

if __name__ == "__main__":
    # Test with a sample post
    sample_post = {
        'title': 'Review: Wireless Bluetooth Earbuds with Noise Cancellation',
        'filepath': '../docs/posts/2023-05-15_wireless_bluetooth_earbuds_with_noise_cancellation.md'
    }
    
    sample_product = {
        'title': 'Wireless Bluetooth Earbuds with Noise Cancellation',
        'price': '$49.99',
        'link': 'https://www.amazon.com/wireless-bluetooth-earbuds?tag=shadowmerch05-21'
    }
    
    # Generate social media posts
    generate_social_media_for_post(sample_post, sample_product)
