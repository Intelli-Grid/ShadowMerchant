#!/usr/bin/env python3
# scripts/run_pipeline.py

"""
This script runs the entire affiliate content pipeline:
1. Scrape products
2. Generate content
3. Validate content
4. Publish content
5. Generate newsletter
"""

import os
import sys
import time
import subprocess
import argparse
from datetime import datetime

def run_command(command, description):
    """
    Run a command and print its output.

    Args:
        command (str): Command to run
        description (str): Description of the command

    Returns:
        bool: True if successful, False otherwise
    """
    print(f"\n{'=' * 80}")
    print(f"STEP: {description}")
    print(f"{'=' * 80}")
    print(f"Running command: {command}")
    print(f"{'-' * 80}")

    try:
        # Run the command and capture output
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True
        )

        # Print output in real-time
        for line in process.stdout:
            print(line, end='')

        # Wait for the process to complete
        process.wait()

        # Check if the command was successful
        if process.returncode == 0:
            print(f"\n✅ {description} completed successfully")
            return True
        else:
            print(f"\n❌ {description} failed with return code {process.returncode}")
            return False

    except Exception as e:
        print(f"\n❌ Error running {description}: {e}")
        return False

def main():
    """
    Run the entire affiliate content pipeline.
    """
    parser = argparse.ArgumentParser(description='Run the affiliate content pipeline')
    parser.add_argument('--max-posts', type=int, default=2, help='Maximum number of posts to generate')
    parser.add_argument('--content-length', choices=['short', 'medium', 'long'], default='medium',
                        help='Length of content to generate')
    parser.add_argument('--skip-scrape', action='store_true', help='Skip scraping products')
    parser.add_argument('--skip-validation', action='store_true', help='Skip content validation')
    parser.add_argument('--skip-publish', action='store_true', help='Skip content publishing')
    parser.add_argument('--skip-newsletter', action='store_true', help='Skip newsletter generation')
    parser.add_argument('--platform', choices=['wordpress'], default='wordpress',
                        help='Platform to publish content to (currently only WordPress is supported)')

    args = parser.parse_args()

    print(f"\n{'#' * 80}")
    print(f"# AFFILIATE CONTENT PIPELINE - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#' * 80}")

    # Step 1: Scrape products
    if not args.skip_scrape:
        if not run_command("python scraper.py", "Scrape products"):
            print("Scraping failed. Exiting pipeline.")
            return False
    else:
        print("\nSkipping product scraping as requested.")

    # Step 2: Generate content
    generator_cmd = f"python generator.py --max-posts {args.max_posts} --content-length {args.content_length}"
    if not run_command(generator_cmd, "Generate content"):
        print("Content generation failed. Exiting pipeline.")
        return False

    # Step 3: Validate content
    if not args.skip_validation:
        if not run_command("python validator.py", "Validate content"):
            print("Content validation failed, but continuing with pipeline.")
    else:
        print("\nSkipping content validation as requested.")

    # Step 4: Publish content
    if not args.skip_publish:
        publish_cmd = f"python publisher.py --platform {args.platform}"
        if not run_command(publish_cmd, "Publish content"):
            print("Content publishing failed, but continuing with pipeline.")
    else:
        print("\nSkipping content publishing as requested.")

    # Step 5: Generate newsletter
    if not args.skip_newsletter:
        if not run_command("python newsletter.py", "Generate newsletter"):
            print("Newsletter generation failed, but continuing with pipeline.")
    else:
        print("\nSkipping newsletter generation as requested.")

    print(f"\n{'#' * 80}")
    print(f"# PIPELINE COMPLETED - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#' * 80}")

    return True

if __name__ == "__main__":
    main()
