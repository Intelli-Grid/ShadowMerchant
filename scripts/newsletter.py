#!/usr/bin/env python3
# scripts/newsletter.py

"""
This module handles email newsletter generation and management.
It creates weekly/monthly product roundups and manages subscribers.
"""

import os
import json
import time
import random
from datetime import datetime, timedelta
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Email configuration
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USER = os.getenv("EMAIL_USER", "")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "")

def load_subscribers():
    """
    Load subscribers from JSON file.

    Returns:
        list: List of subscriber dictionaries
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data/subscribers', exist_ok=True)

        # Load subscribers if file exists
        subscribers_path = '../docs/data/subscribers/subscribers.json'
        if os.path.exists(subscribers_path):
            with open(subscribers_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            return []

    except Exception as e:
        print(f"Error loading subscribers: {e}")
        return []

def save_subscribers(subscribers):
    """
    Save subscribers to JSON file.

    Args:
        subscribers (list): List of subscriber dictionaries

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data/subscribers', exist_ok=True)

        # Save subscribers
        subscribers_path = '../docs/data/subscribers/subscribers.json'
        with open(subscribers_path, 'w', encoding='utf-8') as f:
            json.dump(subscribers, f, indent=2)

        return True

    except Exception as e:
        print(f"Error saving subscribers: {e}")
        return False

def add_subscriber(email, name="", preferences=None):
    """
    Add a new subscriber.

    Args:
        email (str): Subscriber email address
        name (str, optional): Subscriber name
        preferences (dict, optional): Subscriber preferences

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Load existing subscribers
        subscribers = load_subscribers()

        # Check if subscriber already exists
        for subscriber in subscribers:
            if subscriber['email'].lower() == email.lower():
                # Update existing subscriber
                subscriber['name'] = name
                if preferences:
                    subscriber['preferences'] = preferences
                subscriber['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                save_subscribers(subscribers)
                return True

        # Add new subscriber
        new_subscriber = {
            'email': email,
            'name': name,
            'preferences': preferences or {
                'frequency': 'weekly',
                'categories': ['all']
            },
            'status': 'active',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        subscribers.append(new_subscriber)
        save_subscribers(subscribers)

        # Send welcome email
        send_welcome_email(new_subscriber)

        return True

    except Exception as e:
        print(f"Error adding subscriber: {e}")
        return False

def remove_subscriber(email):
    """
    Remove a subscriber.

    Args:
        email (str): Subscriber email address

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Load existing subscribers
        subscribers = load_subscribers()

        # Find subscriber
        for i, subscriber in enumerate(subscribers):
            if subscriber['email'].lower() == email.lower():
                # Remove subscriber
                del subscribers[i]
                save_subscribers(subscribers)
                return True

        return False

    except Exception as e:
        print(f"Error removing subscriber: {e}")
        return False

def update_subscriber_status(email, status):
    """
    Update subscriber status.

    Args:
        email (str): Subscriber email address
        status (str): New status ('active', 'unsubscribed')

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Load existing subscribers
        subscribers = load_subscribers()

        # Find subscriber
        for subscriber in subscribers:
            if subscriber['email'].lower() == email.lower():
                # Update status
                subscriber['status'] = status
                subscriber['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                save_subscribers(subscribers)
                return True

        return False

    except Exception as e:
        print(f"Error updating subscriber status: {e}")
        return False

def load_recent_posts(days=7, max_posts=10):
    """
    Load recent posts for newsletter.

    Args:
        days (int): Number of days to look back
        max_posts (int): Maximum number of posts to include

    Returns:
        list: List of recent post dictionaries
    """
    try:
        # Load posts index
        posts_path = '../docs/data/posts_index.json'
        if not os.path.exists(posts_path):
            return []

        with open(posts_path, 'r', encoding='utf-8') as f:
            posts = json.load(f)

        # Filter recent posts
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        recent_posts = [post for post in posts if post['date'] >= cutoff_date]

        # Sort by date (newest first) and limit
        recent_posts.sort(key=lambda x: x['date'], reverse=True)
        return recent_posts[:max_posts]

    except Exception as e:
        print(f"Error loading recent posts: {e}")
        return []

def load_top_performing_posts(max_posts=5):
    """
    Load top performing posts based on analytics.

    Args:
        max_posts (int): Maximum number of posts to include

    Returns:
        list: List of top performing post dictionaries
    """
    try:
        # Load posts index
        posts_path = '../docs/data/posts_index.json'
        if not os.path.exists(posts_path):
            return []

        with open(posts_path, 'r', encoding='utf-8') as f:
            posts = json.load(f)

        # Load analytics data if available
        analytics_path = '../docs/data/analytics/clicks.json'
        if os.path.exists(analytics_path):
            with open(analytics_path, 'r', encoding='utf-8') as f:
                clicks = json.load(f)

            # Count clicks per post
            post_clicks = {}
            for click in clicks:
                product_id = click['product_id']
                post_clicks[product_id] = post_clicks.get(product_id, 0) + 1

            # Add click count to posts
            for post in posts:
                product_id = post['title'].lower().replace(' ', '_')
                post['clicks'] = post_clicks.get(product_id, 0)

            # Sort by clicks (highest first) and limit
            posts.sort(key=lambda x: x.get('clicks', 0), reverse=True)
            return posts[:max_posts]

        # If no analytics, return random posts
        random.shuffle(posts)
        return posts[:max_posts]

    except Exception as e:
        print(f"Error loading top performing posts: {e}")
        return []

def generate_newsletter_content(frequency='weekly'):
    """
    Generate newsletter content.

    Args:
        frequency (str): Newsletter frequency ('weekly', 'monthly')

    Returns:
        dict: Newsletter content with HTML and plain text versions
    """
    try:
        # Load recent posts
        days = 7 if frequency == 'weekly' else 30
        recent_posts = load_recent_posts(days=days, max_posts=5)

        # Load top performing posts
        top_posts = load_top_performing_posts(max_posts=3)

        # Generate newsletter title
        if frequency == 'weekly':
            title = f"Weekly Affiliate Roundup - {datetime.now().strftime('%B %d, %Y')}"
        else:
            title = f"Monthly Affiliate Digest - {datetime.now().strftime('%B %Y')}"

        # Generate HTML content
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
            margin-bottom: 20px;
        }}
        .section {{
            margin-bottom: 30px;
        }}
        .post {{
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }}
        .post h3 {{
            margin-top: 0;
            margin-bottom: 10px;
        }}
        .post-meta {{
            font-size: 0.9em;
            color: #666;
            margin-bottom: 10px;
        }}
        .cta-button {{
            display: inline-block;
            background-color: #4a6fa5;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 10px;
        }}
        .footer {{
            text-align: center;
            font-size: 0.8em;
            color: #666;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{title}</h1>
        <p>The latest and greatest affiliate products, curated just for you.</p>
    </div>

    <div class="section">
        <h2>📣 Latest Reviews</h2>
"""

        # Add recent posts
        if recent_posts:
            for post in recent_posts:
                html_content += f"""
        <div class="post">
            <h3>{post['title']}</h3>
            <div class="post-meta">
                <span>Source: {post['source']}</span> |
                <span>Price: {post['price']}</span> |
                <span>Date: {post['date']}</span>
            </div>
            <p>Check out our latest review of this amazing product!</p>
            <a href="{post['product_link']}" class="cta-button">View Product</a>
        </div>"""
        else:
            html_content += "<p>No recent reviews available.</p>"

        html_content += """
    </div>

    <div class="section">
        <h2>🔥 Top Performing Products</h2>
"""

        # Add top posts
        if top_posts:
            for post in top_posts:
                html_content += f"""
        <div class="post">
            <h3>{post['title']}</h3>
            <div class="post-meta">
                <span>Source: {post['source']}</span> |
                <span>Price: {post['price']}</span>
            </div>
            <p>This product has been getting a lot of attention!</p>
            <a href="{post['product_link']}" class="cta-button">View Product</a>
        </div>"""
        else:
            html_content += "<p>No top performing products available.</p>"

        html_content += """
    </div>

    <div class="footer">
        <p>You're receiving this email because you subscribed to our affiliate newsletter.</p>
        <p><a href="{{unsubscribe_link}}">Unsubscribe</a> | <a href="{{preferences_link}}">Update Preferences</a></p>
    </div>
</body>
</html>
"""

        # Generate plain text content
        plain_text = f"""
{title}
{'=' * len(title)}

The latest and greatest affiliate products, curated just for you.

LATEST REVIEWS
--------------
"""

        # Add recent posts to plain text
        if recent_posts:
            for post in recent_posts:
                plain_text += f"""
{post['title']}
Source: {post['source']} | Price: {post['price']} | Date: {post['date']}

Check out our latest review of this amazing product!

View Product: {post['product_link']}
"""
        else:
            plain_text += "No recent reviews available."

        plain_text += """

TOP PERFORMING PRODUCTS
----------------------
"""

        # Add top posts to plain text
        if top_posts:
            for post in top_posts:
                plain_text += f"""
{post['title']}
Source: {post['source']} | Price: {post['price']}

This product has been getting a lot of attention!

View Product: {post['product_link']}
"""
        else:
            plain_text += "No top performing products available."

        plain_text += """

---

You're receiving this email because you subscribed to our affiliate newsletter.

Unsubscribe: {{unsubscribe_link}}
Update Preferences: {{preferences_link}}
"""

        return {
            'subject': title,
            'html': html_content,
            'text': plain_text
        }

    except Exception as e:
        print(f"Error generating newsletter content: {e}")
        return None

def send_email(to_email, subject, html_content, text_content):
    """
    Send an email.

    Args:
        to_email (str): Recipient email address
        subject (str): Email subject
        html_content (str): HTML email content
        text_content (str): Plain text email content

    Returns:
        bool: True if successful, False otherwise
    """
    if not EMAIL_USER or not EMAIL_PASSWORD:
        print("Email credentials not configured. Skipping email send.")
        return False

    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = EMAIL_FROM or EMAIL_USER
        msg['To'] = to_email

        # Attach parts
        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html_content, 'html')
        msg.attach(part1)
        msg.attach(part2)

        # Send email
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.send_message(msg)

        return True

    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def send_welcome_email(subscriber):
    """
    Send welcome email to new subscriber.

    Args:
        subscriber (dict): Subscriber information

    Returns:
        bool: True if successful, False otherwise
    """
    # Generate unsubscribe and preferences links
    unsubscribe_link = f"https://yourdomain.com/unsubscribe?email={subscriber['email']}"
    preferences_link = f"https://yourdomain.com/preferences?email={subscriber['email']}"

    # Generate email content
    subject = "Welcome to Our Affiliate Newsletter!"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Our Affiliate Newsletter!</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                text-align: center;
                padding-bottom: 20px;
                border-bottom: 1px solid #eee;
                margin-bottom: 20px;
            }}
            .content {{
                margin-bottom: 30px;
            }}
            .cta-button {{
                display: inline-block;
                background-color: #4a6fa5;
                color: white;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 4px;
                margin-top: 10px;
            }}
            .footer {{
                text-align: center;
                font-size: 0.8em;
                color: #666;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Welcome to Our Affiliate Newsletter!</h1>
        </div>

        <div class="content">
            <p>Hi {subscriber['name'] or 'there'},</p>

            <p>Thank you for subscribing to our affiliate newsletter! We're excited to share the latest and greatest products with you.</p>

            <p>Here's what you can expect:</p>
            <ul>
                <li>Weekly roundups of our latest product reviews</li>
                <li>Exclusive deals and discounts</li>
                <li>Tips and tricks for making the most of your purchases</li>
            </ul>

            <p>Stay tuned for our next newsletter!</p>

            <a href="https://yourdomain.com" class="cta-button">Visit Our Website</a>
        </div>

        <div class="footer">
            <p>You're receiving this email because you subscribed to our affiliate newsletter.</p>
            <p><a href="{unsubscribe_link}">Unsubscribe</a> | <a href="{preferences_link}">Update Preferences</a></p>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Welcome to Our Affiliate Newsletter!
    ===================================

    Hi {subscriber['name'] or 'there'},

    Thank you for subscribing to our affiliate newsletter! We're excited to share the latest and greatest products with you.

    Here's what you can expect:
    - Weekly roundups of our latest product reviews
    - Exclusive deals and discounts
    - Tips and tricks for making the most of your purchases

    Stay tuned for our next newsletter!

    Visit Our Website: https://yourdomain.com

    ---

    You're receiving this email because you subscribed to our affiliate newsletter.

    Unsubscribe: {unsubscribe_link}
    Update Preferences: {preferences_link}
    """

    return send_email(subscriber['email'], subject, html_content, text_content)

def send_newsletter(frequency='weekly'):
    """
    Send newsletter to all active subscribers.

    Args:
        frequency (str): Newsletter frequency ('weekly', 'monthly')

    Returns:
        dict: Results with success and failure counts
    """
    try:
        # Load subscribers
        subscribers = load_subscribers()

        # Filter active subscribers with matching frequency preference
        active_subscribers = [s for s in subscribers if s['status'] == 'active' and
                             (s['preferences'].get('frequency', 'weekly') == frequency or
                              s['preferences'].get('frequency', 'weekly') == 'both')]

        if not active_subscribers:
            print(f"No active subscribers for {frequency} newsletter.")
            return {'success': 0, 'failure': 0, 'total': 0}

        # Generate newsletter content
        newsletter = generate_newsletter_content(frequency)
        if not newsletter:
            print("Failed to generate newsletter content.")
            return {'success': 0, 'failure': 0, 'total': 0}

        # Send to each subscriber
        success_count = 0
        failure_count = 0

        for subscriber in active_subscribers:
            # Generate personalized unsubscribe and preferences links
            unsubscribe_link = f"https://yourdomain.com/unsubscribe?email={subscriber['email']}"
            preferences_link = f"https://yourdomain.com/preferences?email={subscriber['email']}"

            # Personalize content
            html_content = newsletter['html'].replace('{unsubscribe_link}', unsubscribe_link).replace('{preferences_link}', preferences_link)
            text_content = newsletter['text'].replace('{unsubscribe_link}', unsubscribe_link).replace('{preferences_link}', preferences_link)

            # Send email
            if send_email(subscriber['email'], newsletter['subject'], html_content, text_content):
                success_count += 1
            else:
                failure_count += 1

            # Respect rate limits
            time.sleep(1)

        # Log results
        print(f"Newsletter sent: {success_count} successful, {failure_count} failed, {len(active_subscribers)} total")

        # Save newsletter to history
        save_newsletter_history(newsletter, frequency, success_count, failure_count)

        return {
            'success': success_count,
            'failure': failure_count,
            'total': len(active_subscribers)
        }

    except Exception as e:
        print(f"Error sending newsletter: {e}")
        return {'success': 0, 'failure': 0, 'total': 0}

def save_newsletter_history(newsletter, frequency, success_count, failure_count):
    """
    Save newsletter to history.

    Args:
        newsletter (dict): Newsletter content
        frequency (str): Newsletter frequency
        success_count (int): Number of successful sends
        failure_count (int): Number of failed sends

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data/newsletters', exist_ok=True)

        # Load existing history if file exists
        history_path = '../docs/data/newsletters/history.json'
        if os.path.exists(history_path):
            with open(history_path, 'r', encoding='utf-8') as f:
                history = json.load(f)
        else:
            history = []

        # Create history entry
        entry = {
            'subject': newsletter['subject'],
            'frequency': frequency,
            'sent_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'success_count': success_count,
            'failure_count': failure_count,
            'total_count': success_count + failure_count
        }

        # Add to history
        history.append(entry)

        # Save updated history
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2)

        # Save newsletter content
        content_path = f'../docs/data/newsletters/{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        with open(content_path, 'w', encoding='utf-8') as f:
            json.dump(newsletter, f, indent=2)

        return True

    except Exception as e:
        print(f"Error saving newsletter history: {e}")
        return False

def generate_sample_subscribers(count=10):
    """
    Generate sample subscribers for testing.

    Args:
        count (int): Number of subscribers to generate

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create sample subscribers
        domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'example.com']
        first_names = ['John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Lisa', 'William', 'Jennifer']
        last_names = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor']

        subscribers = []

        for i in range(count):
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            domain = random.choice(domains)
            email = f"{first_name.lower()}.{last_name.lower()}@{domain}"

            subscriber = {
                'email': email,
                'name': f"{first_name} {last_name}",
                'preferences': {
                    'frequency': random.choice(['weekly', 'monthly', 'both']),
                    'categories': random.sample(['tech', 'home', 'fitness', 'digital', 'all'], random.randint(1, 3))
                },
                'status': random.choices(['active', 'unsubscribed'], weights=[0.9, 0.1])[0],
                'created_at': (datetime.now() - timedelta(days=random.randint(1, 90))).strftime('%Y-%m-%d %H:%M:%S'),
                'updated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }

            subscribers.append(subscriber)

        # Save subscribers
        save_subscribers(subscribers)

        print(f"Generated {count} sample subscribers")
        return True

    except Exception as e:
        print(f"Error generating sample subscribers: {e}")
        return False

if __name__ == "__main__":
    # Generate sample data for testing
    generate_sample_subscribers(20)

    # Generate and print a sample newsletter
    newsletter = generate_newsletter_content('weekly')
    if newsletter:
        print("\nNewsletter Subject:", newsletter['subject'])
        print("\nPlain Text Preview:")
        print(newsletter['text'][:500] + "...")

        # Save sample newsletter to file
        os.makedirs('../docs/data/newsletters', exist_ok=True)
        with open('../docs/data/newsletters/sample_newsletter.html', 'w', encoding='utf-8') as f:
            f.write(newsletter['html'])

        print("\nSample newsletter HTML saved to ../docs/data/newsletters/sample_newsletter.html")
