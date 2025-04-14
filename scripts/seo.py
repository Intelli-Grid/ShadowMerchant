#!/usr/bin/env python3
# scripts/seo.py

"""
This module handles SEO optimization for generated content.
It creates meta tags, schema markup, and implements smart internal linking.
"""

import os
import json
import re
from datetime import datetime
import random
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Site configuration
SITE_NAME = os.getenv("SITE_NAME", "Affiliate Product Reviews")
SITE_URL = os.getenv("SITE_URL", "https://yourdomain.com")
SITE_LOGO = os.getenv("SITE_LOGO", f"{SITE_URL}/images/logo.png")
SITE_AUTHOR = os.getenv("SITE_AUTHOR", "Affiliate Expert")

def generate_meta_tags(post_data):
    """
    Generate meta tags for a blog post.
    
    Args:
        post_data (dict): Blog post data
        
    Returns:
        str: HTML meta tags
    """
    # Extract post information
    title = post_data['title']
    
    # Generate description from content
    description = ""
    try:
        with open(post_data['filepath'], 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Extract first paragraph after the front matter
            front_matter_end = content.find('---', 4) + 3
            first_paragraph = re.search(r'(?:\n\n)(.*?)(?:\n\n)', content[front_matter_end:])
            if first_paragraph:
                description = first_paragraph.group(1).strip()
                
                # Remove markdown formatting
                description = re.sub(r'[#*_`]', '', description)
                
                # Truncate to 160 characters
                if len(description) > 160:
                    description = description[:157] + '...'
            else:
                # Fallback description
                description = f"Read our detailed review of {title} and find out if it's worth your money."
    except Exception as e:
        print(f"Error generating description: {e}")
        description = f"Read our detailed review of {title} and find out if it's worth your money."
    
    # Generate keywords
    keywords = []
    
    # Add product name
    product_name = title.replace('Review: ', '')
    keywords.append(product_name)
    
    # Add product type
    product_words = product_name.lower().split()
    if len(product_words) > 2:
        product_type = product_words[-2] + ' ' + product_words[-1]
        keywords.append(product_type)
    
    # Add year
    current_year = datetime.now().year
    keywords.append(f"best {product_words[0]} {current_year}")
    
    # Add review keyword
    keywords.append(f"{product_words[0]} review")
    
    # Add source
    keywords.append(f"{post_data['source']} products")
    
    # Join keywords
    keywords_str = ', '.join(keywords)
    
    # Generate meta tags
    meta_tags = f"""
    <!-- Primary Meta Tags -->
    <meta name="title" content="{title}">
    <meta name="description" content="{description}">
    <meta name="keywords" content="{keywords_str}">
    <meta name="author" content="{SITE_AUTHOR}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="{SITE_URL}/posts/{os.path.basename(post_data['filepath'])}">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{post_data.get('image', SITE_LOGO)}">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="{SITE_URL}/posts/{os.path.basename(post_data['filepath'])}">
    <meta property="twitter:title" content="{title}">
    <meta property="twitter:description" content="{description}">
    <meta property="twitter:image" content="{post_data.get('image', SITE_LOGO)}">
    """
    
    return meta_tags

def generate_schema_markup(post_data):
    """
    Generate schema markup for a blog post.
    
    Args:
        post_data (dict): Blog post data
        
    Returns:
        str: JSON-LD schema markup
    """
    # Extract post information
    title = post_data['title']
    product_name = title.replace('Review: ', '')
    date = post_data['date']
    
    # Generate description from content
    description = ""
    rating = random.uniform(4.0, 5.0)  # Generate a random rating between 4.0 and 5.0
    rating = round(rating, 1)  # Round to 1 decimal place
    
    try:
        with open(post_data['filepath'], 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Extract first paragraph after the front matter
            front_matter_end = content.find('---', 4) + 3
            first_paragraph = re.search(r'(?:\n\n)(.*?)(?:\n\n)', content[front_matter_end:])
            if first_paragraph:
                description = first_paragraph.group(1).strip()
                
                # Remove markdown formatting
                description = re.sub(r'[#*_`]', '', description)
            else:
                # Fallback description
                description = f"Read our detailed review of {product_name} and find out if it's worth your money."
    except Exception as e:
        print(f"Error generating description: {e}")
        description = f"Read our detailed review of {product_name} and find out if it's worth your money."
    
    # Generate schema markup
    schema_markup = f"""
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "mainEntityOfPage": {{
            "@type": "WebPage",
            "@id": "{SITE_URL}/posts/{os.path.basename(post_data['filepath'])}"
        }},
        "headline": "{title}",
        "description": "{description}",
        "image": "{post_data.get('image', SITE_LOGO)}",
        "author": {{
            "@type": "Person",
            "name": "{SITE_AUTHOR}"
        }},
        "publisher": {{
            "@type": "Organization",
            "name": "{SITE_NAME}",
            "logo": {{
                "@type": "ImageObject",
                "url": "{SITE_LOGO}"
            }}
        }},
        "datePublished": "{date}T00:00:00+00:00",
        "dateModified": "{date}T00:00:00+00:00",
        "review": {{
            "@type": "Review",
            "reviewRating": {{
                "@type": "Rating",
                "ratingValue": "{rating}",
                "bestRating": "5"
            }},
            "author": {{
                "@type": "Person",
                "name": "{SITE_AUTHOR}"
            }},
            "itemReviewed": {{
                "@type": "Product",
                "name": "{product_name}",
                "offers": {{
                    "@type": "Offer",
                    "price": "{post_data['price'].replace('$', '')}",
                    "priceCurrency": "USD",
                    "availability": "https://schema.org/InStock",
                    "url": "{post_data['product_link']}"
                }}
            }}
        }}
    }}
    </script>
    """
    
    return schema_markup

def find_related_posts(post_data, max_posts=3):
    """
    Find related posts for internal linking.
    
    Args:
        post_data (dict): Blog post data
        max_posts (int): Maximum number of related posts to find
        
    Returns:
        list: List of related post dictionaries
    """
    try:
        # Load posts index
        posts_path = '../docs/data/posts_index.json'
        if not os.path.exists(posts_path):
            return []
        
        with open(posts_path, 'r', encoding='utf-8') as f:
            posts = json.load(f)
        
        # Filter out the current post
        other_posts = [p for p in posts if p['title'] != post_data['title']]
        if not other_posts:
            return []
        
        # Find posts with the same source
        same_source_posts = [p for p in other_posts if p['source'] == post_data['source']]
        
        # Find posts with similar keywords
        product_words = post_data['title'].lower().split()
        similar_posts = []
        
        for post in other_posts:
            post_words = post['title'].lower().split()
            # Check for word overlap
            common_words = set(product_words) & set(post_words)
            if len(common_words) > 0:
                similar_posts.append((post, len(common_words)))
        
        # Sort by similarity (number of common words)
        similar_posts.sort(key=lambda x: x[1], reverse=True)
        similar_posts = [p[0] for p in similar_posts]
        
        # Combine related posts
        related_posts = []
        
        # Add similar posts first
        for post in similar_posts:
            if post not in related_posts:
                related_posts.append(post)
                if len(related_posts) >= max_posts:
                    break
        
        # Add same source posts if needed
        if len(related_posts) < max_posts:
            for post in same_source_posts:
                if post not in related_posts:
                    related_posts.append(post)
                    if len(related_posts) >= max_posts:
                        break
        
        # Add random posts if needed
        if len(related_posts) < max_posts:
            random.shuffle(other_posts)
            for post in other_posts:
                if post not in related_posts:
                    related_posts.append(post)
                    if len(related_posts) >= max_posts:
                        break
        
        return related_posts[:max_posts]
    
    except Exception as e:
        print(f"Error finding related posts: {e}")
        return []

def generate_internal_links_section(post_data):
    """
    Generate an internal links section for a blog post.
    
    Args:
        post_data (dict): Blog post data
        
    Returns:
        str: Markdown internal links section
    """
    related_posts = find_related_posts(post_data)
    
    if not related_posts:
        return ""
    
    # Generate internal links section
    section = "\n\n## You May Also Like\n\n"
    
    for post in related_posts:
        post_filename = os.path.basename(post['filepath'])
        section += f"* [{post['title']}]({post_filename}) - {post['source']} product priced at {post['price']}\n"
    
    return section

def optimize_post_seo(post_data):
    """
    Optimize a blog post for SEO.
    
    Args:
        post_data (dict): Blog post data
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Read post content
        with open(post_data['filepath'], 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find front matter
        front_matter_start = content.find('---')
        front_matter_end = content.find('---', front_matter_start + 3) + 3
        
        front_matter = content[:front_matter_end]
        post_content = content[front_matter_end:]
        
        # Generate meta tags and schema markup
        meta_tags = generate_meta_tags(post_data)
        schema_markup = generate_schema_markup(post_data)
        
        # Add meta tags and schema markup to front matter
        new_front_matter = front_matter.rstrip() + "\n"
        new_front_matter += "seo_tags: |\n"
        for line in meta_tags.strip().split('\n'):
            new_front_matter += f"  {line.strip()}\n"
        
        new_front_matter += "schema_markup: |\n"
        for line in schema_markup.strip().split('\n'):
            new_front_matter += f"  {line.strip()}\n"
        
        new_front_matter += "---\n"
        
        # Generate internal links section
        internal_links = generate_internal_links_section(post_data)
        
        # Add internal links to post content
        new_content = post_content
        
        # Check if post already has internal links section
        if "## You May Also Like" not in new_content:
            # Add internal links before the affiliate disclosure
            if "*Disclosure:" in new_content:
                disclosure_index = new_content.find("*Disclosure:")
                new_content = new_content[:disclosure_index] + internal_links + "\n\n" + new_content[disclosure_index:]
            else:
                # Add at the end
                new_content += internal_links
        
        # Save optimized post
        optimized_content = new_front_matter + new_content
        
        with open(post_data['filepath'], 'w', encoding='utf-8') as f:
            f.write(optimized_content)
        
        print(f"Optimized SEO for {post_data['title']}")
        return True
    
    except Exception as e:
        print(f"Error optimizing post SEO: {e}")
        return False

def optimize_all_posts():
    """
    Optimize all blog posts for SEO.
    
    Returns:
        dict: Results with success and failure counts
    """
    try:
        # Load posts index
        posts_path = '../docs/data/posts_index.json'
        if not os.path.exists(posts_path):
            print("No posts found.")
            return {'success': 0, 'failure': 0, 'total': 0}
        
        with open(posts_path, 'r', encoding='utf-8') as f:
            posts = json.load(f)
        
        if not posts:
            print("No posts found.")
            return {'success': 0, 'failure': 0, 'total': 0}
        
        # Optimize each post
        success_count = 0
        failure_count = 0
        
        for post in posts:
            if optimize_post_seo(post):
                success_count += 1
            else:
                failure_count += 1
        
        # Log results
        print(f"SEO optimization complete: {success_count} successful, {failure_count} failed, {len(posts)} total")
        
        return {
            'success': success_count,
            'failure': failure_count,
            'total': len(posts)
        }
    
    except Exception as e:
        print(f"Error optimizing all posts: {e}")
        return {'success': 0, 'failure': 0, 'total': 0}

def update_html_template():
    """
    Update HTML template to include SEO tags and schema markup.
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create template directory if it doesn't exist
        os.makedirs('../templates', exist_ok=True)
        
        # Create post template
        template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
    <link rel="stylesheet" href="../styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    
    <!-- SEO Tags -->
    {{ seo_tags }}
    
    <!-- Schema Markup -->
    {{ schema_markup }}
</head>
<body>
    <div class="container">
        <header>
            <h1>{{ title }}</h1>
            <p class="subtitle">Published on {{ date }} | Source: {{ source }}</p>
            <nav>
                <ul>
                    <li><a href="../index.html">Home</a></li>
                    <li><a href="../analytics.html">Analytics</a></li>
                    <li><a href="../posts.html">Posts</a></li>
                    <li><a href="../subscribe.html">Subscribe</a></li>
                </ul>
            </nav>
        </header>

        <div class="content">
            <article class="post-content">
                {{ content }}
            </article>
        </div>

        <footer>
            <p>© 2025 Affiliate Content Aggregator. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>"""
        
        # Save template
        with open('../templates/post.html', 'w', encoding='utf-8') as f:
            f.write(template)
        
        print("HTML template updated successfully.")
        return True
    
    except Exception as e:
        print(f"Error updating HTML template: {e}")
        return False

if __name__ == "__main__":
    # Update HTML template
    update_html_template()
    
    # Optimize all posts
    optimize_all_posts()
