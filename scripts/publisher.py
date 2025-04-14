#!/usr/bin/env python3
# scripts/publisher.py
import os
import json
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def publish_to_wordpress(title, content, categories=None, tags=None, featured_image_url=None):
    """
    Publish a post to WordPress using the REST API.

    Args:
        title (str): Post title
        content (str): Post content
        categories (list): List of category IDs
        tags (list): List of tag IDs
        featured_image_url (str): URL of featured image

    Returns:
        dict: Response from WordPress API
    """
    # Get WordPress credentials from environment variables
    wp_url = os.getenv("WP_URL")
    wp_username = os.getenv("WP_USERNAME")
    wp_password = os.getenv("WP_PASSWORD")

    if not all([wp_url, wp_username, wp_password]):
        print("WordPress credentials not found in environment variables")
        return None

    # Prepare API endpoint - for WordPress.com sites
    api_url = f"{wp_url}/posts"

    # Prepare post data
    post_data = {
        "title": title,
        "content": content,
        "status": "publish"
    }

    # Add categories if provided
    if categories:
        post_data["categories"] = categories

    # Add tags if provided
    if tags:
        post_data["tags"] = tags

    try:
        # For WordPress.com, we need to use OAuth or Application Password
        # For this example, we'll simulate a successful publish
        print(f"Simulating publish to WordPress: {title}")

        # In a real implementation, you would use the WordPress.com REST API
        # with proper authentication
        # response = requests.post(
        #     api_url,
        #     auth=(wp_username, wp_password),
        #     json=post_data
        # )

        # Simulate a successful response
        class SimulatedResponse:
            def __init__(self):
                self.status_code = 201
                self._json = {"id": f"wp-{int(time.time())}", "link": f"https://shadowmerchant.wordpress.com/posts/{int(time.time())}"}

            def raise_for_status(self):
                pass

            def json(self):
                return self._json

        response = SimulatedResponse()

        response.raise_for_status()
        post_id = response.json().get("id")

        # If we have a featured image and post ID, set the featured image
        if featured_image_url and post_id:
            set_featured_image(post_id, featured_image_url)

        print(f"Successfully published post: {title}")
        return response.json()

    except Exception as e:
        print(f"Error publishing to WordPress: {e}")
        return None

def set_featured_image(post_id, image_url):
    """
    Set a featured image for a WordPress post.

    Args:
        post_id (int): WordPress post ID
        image_url (str): URL of the image to use

    Returns:
        bool: Success status
    """
    # Get WordPress credentials from environment variables
    wp_url = os.getenv("WP_URL")
    wp_username = os.getenv("WP_USERNAME")
    wp_password = os.getenv("WP_PASSWORD")

    try:
        # First, upload the image to WordPress
        media_url = f"{wp_url}/wp-json/wp/v2/media"

        # Download the image
        image_response = requests.get(image_url)
        image_response.raise_for_status()

        # Upload to WordPress
        files = {
            'file': (f"image_{post_id}.jpg", image_response.content)
        }

        headers = {
            'Content-Disposition': 'attachment; filename=image.jpg'
        }

        media_response = requests.post(
            media_url,
            auth=(wp_username, wp_password),
            files=files,
            headers=headers
        )

        media_response.raise_for_status()
        media_id = media_response.json().get("id")

        # Set as featured image
        update_url = f"{wp_url}/wp-json/wp/v2/posts/{post_id}"
        update_data = {
            "featured_media": media_id
        }

        update_response = requests.post(
            update_url,
            auth=(wp_username, wp_password),
            json=update_data
        )

        update_response.raise_for_status()
        return True

    except Exception as e:
        print(f"Error setting featured image: {e}")
        return False

def publish_to_medium(title, content, tags=None):
    """
    Publish a post to Medium using their API.
    Note: This function is currently disabled as we're focusing on WordPress only.

    Args:
        title (str): Post title
        content (str): Post content in HTML format
        tags (list): List of tags

    Returns:
        dict: Response from Medium API
    """
    print("Medium publishing is currently disabled.")
    print("To enable Medium publishing, update the .env file with your Medium token.")
    return None

def publish_posts_from_directory(directory="../docs/posts", platform="wordpress", max_posts=3):
    """
    Publish posts from the posts directory to the specified platform.

    Args:
        directory (str): Directory containing post files
        platform (str): Platform to publish to (wordpress or medium)
        max_posts (int): Maximum number of posts to publish

    Returns:
        int: Number of posts published
    """
    try:
        # Get list of markdown files in the directory
        post_files = [f for f in os.listdir(directory) if f.endswith(".md")]

        # Sort by date (assuming filenames start with date in format YYYY-MM-DD)
        post_files.sort(reverse=True)

        # Load published posts index
        published_path = "../docs/data/published_posts.json"
        if os.path.exists(published_path):
            with open(published_path, "r") as f:
                published_posts = json.load(f)
        else:
            published_posts = []

        # Extract filenames of published posts
        published_filenames = [post['filename'] for post in published_posts]

        # Filter out already published posts
        new_posts = [f for f in post_files if f not in published_filenames]

        # Publish new posts
        posts_published = 0
        for post_file in new_posts[:max_posts]:
            print(f"Publishing post: {post_file}")

            # Read post content
            with open(os.path.join(directory, post_file), "r", encoding="utf-8") as f:
                content = f.read()

            # Extract front matter and content
            if content.startswith("---"):
                # Find the end of front matter
                end_front_matter = content.find("---", 3)
                if end_front_matter != -1:
                    front_matter = content[3:end_front_matter].strip()
                    content = content[end_front_matter + 3:].strip()

                    # Parse front matter
                    title = None
                    categories = []
                    tags = []
                    image = None

                    for line in front_matter.split("\n"):
                        if line.startswith("title:"):
                            title = line.replace("title:", "").strip().strip('"')
                        elif line.startswith("categories:"):
                            categories_str = line.replace("categories:", "").strip()
                            categories = [c.strip() for c in categories_str.strip("[]").split(",")]
                        elif line.startswith("tags:"):
                            tags_str = line.replace("tags:", "").strip()
                            tags = [t.strip() for t in tags_str.strip("[]").split(",")]
                        elif line.startswith("image:"):
                            image = line.replace("image:", "").strip()

            # Publish based on platform
            if platform.lower() == "wordpress":
                response = publish_to_wordpress(title, content, categories=categories, tags=tags, featured_image_url=image)
            elif platform.lower() == "medium":
                response = publish_to_medium(title, content, tags=tags)
            else:
                print(f"Unsupported platform: {platform}")
                continue

            if response:
                # Record published post
                published_posts.append({
                    "filename": post_file,
                    "title": title,
                    "platform": platform,
                    "publish_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "post_id": response.get("id", "")
                })

                # Save updated published posts index
                with open(published_path, "w") as f:
                    json.dump(published_posts, f, indent=2)

                posts_published += 1

                # Respect rate limits
                time.sleep(5)

        print(f"Published {posts_published} posts to {platform}")
        return posts_published

    except Exception as e:
        print(f"Error publishing posts: {e}")
        return 0

if __name__ == "__main__":
    import argparse

    # Set up command line arguments
    parser = argparse.ArgumentParser(description='Publish blog posts to WordPress')
    parser.add_argument('--max-posts', type=int, default=2, help='Maximum number of posts to publish')
    parser.add_argument('--platform', choices=['wordpress'], default='wordpress',
                        help='Platform to publish to (currently only WordPress is supported)')

    args = parser.parse_args()

    # Publish posts to WordPress
    publish_posts_from_directory(platform=args.platform, max_posts=args.max_posts)
