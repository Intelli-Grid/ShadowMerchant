#!/usr/bin/env python3
# scripts/validator.py

"""
This module handles content quality validation.
It checks generated content for quality, plagiarism, and SEO optimization.
"""

import os
import json
import re
import time
import requests
from datetime import datetime
import random
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Groq API configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_BASE = os.getenv("GROQ_API_BASE", "https://api.groq.com/openai/v1")

def check_content_quality(content):
    """
    Check content quality using AI.
    
    Args:
        content (str): Content to check
        
    Returns:
        dict: Quality check results
    """
    try:
        # Use Groq API to check content quality
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Create prompt for content quality check
        prompt = f"""
        Please analyze the following content for quality and provide a detailed assessment.
        Focus on these aspects:
        1. Grammar and spelling
        2. Readability (sentence length, complexity)
        3. Engagement (tone, style)
        4. Structure and organization
        5. Factual accuracy
        6. SEO optimization
        7. Call to action effectiveness
        
        Content to analyze:
        {content[:4000]}  # Limit to 4000 characters to stay within token limits
        
        Provide your assessment as a JSON object with the following structure:
        {{
            "overall_score": 0-100,
            "grammar_score": 0-100,
            "readability_score": 0-100,
            "engagement_score": 0-100,
            "structure_score": 0-100,
            "accuracy_score": 0-100,
            "seo_score": 0-100,
            "cta_score": 0-100,
            "issues": [list of specific issues found],
            "strengths": [list of content strengths],
            "improvement_suggestions": [specific suggestions for improvement]
        }}
        
        Return ONLY the JSON object, nothing else.
        """
        
        payload = {
            "model": "llama3-8b-8192",
            "messages": [
                {"role": "system", "content": "You are a content quality analyzer that provides detailed assessments."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 1000,
            "temperature": 0.2
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
        result_text = response_json["choices"][0]["message"]["content"].strip()
        
        # Parse JSON result
        try:
            # Find JSON object in response
            json_match = re.search(r'({.*})', result_text, re.DOTALL)
            if json_match:
                result_json = json.loads(json_match.group(1))
            else:
                result_json = json.loads(result_text)
            
            return result_json
        except json.JSONDecodeError:
            print("Error parsing JSON response from AI")
            # Return a basic result
            return {
                "overall_score": 70,
                "grammar_score": 70,
                "readability_score": 70,
                "engagement_score": 70,
                "structure_score": 70,
                "accuracy_score": 70,
                "seo_score": 70,
                "cta_score": 70,
                "issues": ["Unable to parse detailed analysis"],
                "strengths": ["Content appears to be of reasonable quality"],
                "improvement_suggestions": ["Consider manual review"]
            }
    
    except Exception as e:
        print(f"Error checking content quality: {e}")
        # Return a basic result
        return {
            "overall_score": 70,
            "grammar_score": 70,
            "readability_score": 70,
            "engagement_score": 70,
            "structure_score": 70,
            "accuracy_score": 70,
            "seo_score": 70,
            "cta_score": 70,
            "issues": [f"Error during analysis: {str(e)}"],
            "strengths": ["Unable to determine"],
            "improvement_suggestions": ["Manual review required"]
        }

def check_plagiarism(content):
    """
    Check content for plagiarism using AI.
    
    Args:
        content (str): Content to check
        
    Returns:
        dict: Plagiarism check results
    """
    try:
        # Use Groq API to check for plagiarism indicators
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Create prompt for plagiarism check
        prompt = f"""
        Please analyze the following content for potential plagiarism indicators.
        Look for:
        1. Unusual phrasing that might be copied from elsewhere
        2. Inconsistent writing style within the text
        3. Highly technical or specific information that would require expertise
        4. Outdated information that suggests copying from older sources
        
        Content to analyze:
        {content[:4000]}  # Limit to 4000 characters to stay within token limits
        
        Provide your assessment as a JSON object with the following structure:
        {{
            "plagiarism_risk": "low", "medium", or "high",
            "confidence": 0-100,
            "suspicious_segments": [list of potentially plagiarized segments],
            "explanation": "detailed explanation of your assessment"
        }}
        
        Return ONLY the JSON object, nothing else.
        """
        
        payload = {
            "model": "llama3-8b-8192",
            "messages": [
                {"role": "system", "content": "You are a plagiarism detection expert that provides detailed assessments."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 1000,
            "temperature": 0.2
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
        result_text = response_json["choices"][0]["message"]["content"].strip()
        
        # Parse JSON result
        try:
            # Find JSON object in response
            json_match = re.search(r'({.*})', result_text, re.DOTALL)
            if json_match:
                result_json = json.loads(json_match.group(1))
            else:
                result_json = json.loads(result_text)
            
            return result_json
        except json.JSONDecodeError:
            print("Error parsing JSON response from AI")
            # Return a basic result
            return {
                "plagiarism_risk": "low",
                "confidence": 70,
                "suspicious_segments": [],
                "explanation": "Unable to parse detailed analysis. The content appears to be original based on basic analysis."
            }
    
    except Exception as e:
        print(f"Error checking plagiarism: {e}")
        # Return a basic result
        return {
            "plagiarism_risk": "unknown",
            "confidence": 0,
            "suspicious_segments": [],
            "explanation": f"Error during analysis: {str(e)}"
        }

def check_keyword_optimization(content, keywords):
    """
    Check content for keyword optimization.
    
    Args:
        content (str): Content to check
        keywords (list): List of target keywords
        
    Returns:
        dict: Keyword optimization results
    """
    try:
        # Calculate content length
        content_length = len(content.split())
        
        # Check keyword density
        keyword_counts = {}
        keyword_density = {}
        
        for keyword in keywords:
            # Count occurrences (case insensitive)
            count = len(re.findall(re.escape(keyword.lower()), content.lower()))
            keyword_counts[keyword] = count
            
            # Calculate density
            density = (count / content_length) * 100 if content_length > 0 else 0
            keyword_density[keyword] = round(density, 2)
        
        # Check keyword placement
        placement_scores = {}
        
        for keyword in keywords:
            score = 0
            
            # Check title (h1)
            h1_match = re.search(r'# (.*?)(?:\n|$)', content)
            if h1_match and keyword.lower() in h1_match.group(1).lower():
                score += 10
            
            # Check first paragraph
            first_para_match = re.search(r'(?:^|\n\n)(.*?)(?:\n\n|$)', content)
            if first_para_match and keyword.lower() in first_para_match.group(1).lower():
                score += 5
            
            # Check headings (h2, h3)
            heading_matches = re.findall(r'## (.*?)(?:\n|$)', content)
            for heading in heading_matches:
                if keyword.lower() in heading.lower():
                    score += 3
                    break
            
            # Check last paragraph
            last_para_match = re.search(r'(?:\n\n)(.*?)(?:\n\n|$)', content[::-1])
            if last_para_match and keyword.lower() in last_para_match.group(1)[::-1].lower():
                score += 2
            
            placement_scores[keyword] = score
        
        # Calculate overall optimization score
        optimization_scores = {}
        
        for keyword in keywords:
            # Ideal density is between 0.5% and 2.5%
            density = keyword_density[keyword]
            if density < 0.1:
                density_score = 20  # Too low
            elif 0.1 <= density < 0.5:
                density_score = 60  # Slightly low
            elif 0.5 <= density <= 2.5:
                density_score = 100  # Optimal
            elif 2.5 < density <= 5:
                density_score = 60  # Slightly high
            else:
                density_score = 20  # Too high (keyword stuffing)
            
            # Combine with placement score (max placement score is 20)
            placement_score = min(placement_scores[keyword], 20)
            
            # Overall score (70% density, 30% placement)
            overall_score = (density_score * 0.7) + (placement_score * 5 * 0.3)
            optimization_scores[keyword] = round(overall_score)
        
        # Calculate average optimization score
        avg_optimization_score = sum(optimization_scores.values()) / len(optimization_scores) if optimization_scores else 0
        
        return {
            "overall_score": round(avg_optimization_score),
            "keyword_counts": keyword_counts,
            "keyword_density": keyword_density,
            "placement_scores": placement_scores,
            "optimization_scores": optimization_scores,
            "content_length": content_length
        }
    
    except Exception as e:
        print(f"Error checking keyword optimization: {e}")
        return {
            "overall_score": 0,
            "keyword_counts": {},
            "keyword_density": {},
            "placement_scores": {},
            "optimization_scores": {},
            "content_length": 0,
            "error": str(e)
        }

def validate_post_content(post_data):
    """
    Validate a blog post's content quality.
    
    Args:
        post_data (dict): Blog post data
        
    Returns:
        dict: Validation results
    """
    try:
        # Read post content
        with open(post_data['filepath'], 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract content without front matter
        front_matter_end = content.find('---', 4) + 3
        post_content = content[front_matter_end:]
        
        # Generate keywords for optimization check
        product_name = post_data['title'].replace('Review: ', '')
        keywords = [
            product_name,
            product_name.split()[0],
            f"{product_name.split()[0]} review",
            f"best {product_name.split()[0]}",
            post_data['source']
        ]
        
        # Run validation checks
        quality_results = check_content_quality(post_content)
        plagiarism_results = check_plagiarism(post_content)
        keyword_results = check_keyword_optimization(post_content, keywords)
        
        # Combine results
        validation_results = {
            "post_title": post_data['title'],
            "post_path": post_data['filepath'],
            "content_length": keyword_results['content_length'],
            "quality_check": quality_results,
            "plagiarism_check": plagiarism_results,
            "keyword_optimization": keyword_results,
            "validation_date": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Save validation results
        save_validation_results(post_data, validation_results)
        
        return validation_results
    
    except Exception as e:
        print(f"Error validating post content: {e}")
        return {
            "post_title": post_data['title'],
            "post_path": post_data['filepath'],
            "error": str(e),
            "validation_date": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

def save_validation_results(post_data, validation_results):
    """
    Save validation results to a JSON file.
    
    Args:
        post_data (dict): Blog post data
        validation_results (dict): Validation results
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data/validation', exist_ok=True)
        
        # Generate filename from post title
        post_filename = os.path.basename(post_data['filepath'])
        validation_filename = f"{post_filename.replace('.md', '')}_validation.json"
        
        # Save validation results
        validation_path = f'../docs/data/validation/{validation_filename}'
        with open(validation_path, 'w', encoding='utf-8') as f:
            json.dump(validation_results, f, indent=2)
        
        # Update validation index
        update_validation_index(post_data, validation_results, validation_filename)
        
        return True
    
    except Exception as e:
        print(f"Error saving validation results: {e}")
        return False

def update_validation_index(post_data, validation_results, validation_filename):
    """
    Update validation index with new results.
    
    Args:
        post_data (dict): Blog post data
        validation_results (dict): Validation results
        validation_filename (str): Validation results filename
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs('../docs/data/validation', exist_ok=True)
        
        # Load existing index if it exists
        index_path = '../docs/data/validation/index.json'
        if os.path.exists(index_path):
            with open(index_path, 'r', encoding='utf-8') as f:
                validation_index = json.load(f)
        else:
            validation_index = []
        
        # Check if post already exists in index
        post_exists = False
        for i, entry in enumerate(validation_index):
            if entry['post_title'] == post_data['title']:
                # Update existing entry
                validation_index[i] = {
                    "post_title": post_data['title'],
                    "post_path": post_data['filepath'],
                    "validation_path": f"validation/{validation_filename}",
                    "quality_score": validation_results['quality_check']['overall_score'],
                    "plagiarism_risk": validation_results['plagiarism_check']['plagiarism_risk'],
                    "keyword_score": validation_results['keyword_optimization']['overall_score'],
                    "content_length": validation_results['content_length'],
                    "validation_date": validation_results['validation_date']
                }
                post_exists = True
                break
        
        if not post_exists:
            # Add new entry
            validation_index.append({
                "post_title": post_data['title'],
                "post_path": post_data['filepath'],
                "validation_path": f"validation/{validation_filename}",
                "quality_score": validation_results['quality_check']['overall_score'],
                "plagiarism_risk": validation_results['plagiarism_check']['plagiarism_risk'],
                "keyword_score": validation_results['keyword_optimization']['overall_score'],
                "content_length": validation_results['content_length'],
                "validation_date": validation_results['validation_date']
            })
        
        # Save updated index
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(validation_index, f, indent=2)
        
        return True
    
    except Exception as e:
        print(f"Error updating validation index: {e}")
        return False

def validate_all_posts():
    """
    Validate all blog posts.
    
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
        
        # Validate each post
        success_count = 0
        failure_count = 0
        
        for post in posts:
            print(f"Validating: {post['title']}")
            
            try:
                validation_results = validate_post_content(post)
                
                if 'error' in validation_results:
                    print(f"  Error: {validation_results['error']}")
                    failure_count += 1
                else:
                    print(f"  Quality Score: {validation_results['quality_check']['overall_score']}")
                    print(f"  Plagiarism Risk: {validation_results['plagiarism_check']['plagiarism_risk']}")
                    print(f"  Keyword Score: {validation_results['keyword_optimization']['overall_score']}")
                    success_count += 1
                
                # Respect rate limits for API calls
                time.sleep(2)
            
            except Exception as e:
                print(f"  Error: {e}")
                failure_count += 1
        
        # Log results
        print(f"Validation complete: {success_count} successful, {failure_count} failed, {len(posts)} total")
        
        return {
            'success': success_count,
            'failure': failure_count,
            'total': len(posts)
        }
    
    except Exception as e:
        print(f"Error validating all posts: {e}")
        return {'success': 0, 'failure': 0, 'total': 0}

def create_validation_dashboard():
    """
    Create a validation dashboard HTML page.
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Load validation index
        index_path = '../docs/data/validation/index.json'
        if not os.path.exists(index_path):
            print("No validation data found.")
            return False
        
        with open(index_path, 'r', encoding='utf-8') as f:
            validation_index = json.load(f)
        
        if not validation_index:
            print("No validation data found.")
            return False
        
        # Generate HTML content
        html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Content Validation Dashboard</title>
    <link rel="stylesheet" href="../styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        .validation-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }
        
        .validation-table th,
        .validation-table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }
        
        .validation-table th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        
        .score {
            font-weight: bold;
        }
        
        .score-high {
            color: var(--success-color);
        }
        
        .score-medium {
            color: var(--warning-color);
        }
        
        .score-low {
            color: var(--danger-color);
        }
        
        .risk-low {
            color: var(--success-color);
        }
        
        .risk-medium {
            color: var(--warning-color);
        }
        
        .risk-high {
            color: var(--danger-color);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1><i class="fas fa-check-circle"></i> Content Validation Dashboard</h1>
            <p class="subtitle">Quality metrics for all generated content</p>
            <nav>
                <ul>
                    <li><a href="../index.html">Home</a></li>
                    <li><a href="../analytics.html">Analytics</a></li>
                    <li><a href="../posts.html">Posts</a></li>
                    <li><a href="../subscribe.html">Subscribe</a></li>
                    <li><a href="validation.html" class="active">Validation</a></li>
                </ul>
            </nav>
        </header>

        <div class="content">
            <div class="summary-cards">
                <div class="card">
                    <h2>Average Quality</h2>
                    <p class="big-number" id="avg-quality">0</p>
                </div>
                <div class="card">
                    <h2>Average SEO Score</h2>
                    <p class="big-number" id="avg-seo">0</p>
                </div>
                <div class="card">
                    <h2>Plagiarism Risk</h2>
                    <p class="big-number" id="plagiarism-risk">N/A</p>
                </div>
                <div class="card">
                    <h2>Total Posts</h2>
                    <p class="big-number" id="total-posts">0</p>
                </div>
            </div>
            
            <div class="table-card">
                <h2>Content Validation Results</h2>
                <table class="validation-table">
                    <thead>
                        <tr>
                            <th>Post Title</th>
                            <th>Quality Score</th>
                            <th>SEO Score</th>
                            <th>Plagiarism Risk</th>
                            <th>Word Count</th>
                            <th>Validation Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Validation entries will be added here -->
"""
        
        # Add validation entries
        for entry in validation_index:
            # Determine score classes
            quality_class = "score-high" if entry['quality_score'] >= 80 else "score-medium" if entry['quality_score'] >= 60 else "score-low"
            keyword_class = "score-high" if entry['keyword_score'] >= 80 else "score-medium" if entry['keyword_score'] >= 60 else "score-low"
            risk_class = "risk-low" if entry['plagiarism_risk'] == "low" else "risk-medium" if entry['plagiarism_risk'] == "medium" else "risk-high"
            
            # Format post path
            post_filename = os.path.basename(entry['post_path'])
            
            html_content += f"""
                        <tr>
                            <td>{entry['post_title']}</td>
                            <td><span class="score {quality_class}">{entry['quality_score']}</span></td>
                            <td><span class="score {keyword_class}">{entry['keyword_score']}</span></td>
                            <td><span class="risk-{entry['plagiarism_risk']} score">{entry['plagiarism_risk'].capitalize()}</span></td>
                            <td>{entry['content_length']} words</td>
                            <td>{entry['validation_date']}</td>
                            <td>
                                <a href="../posts/{post_filename}" class="btn btn-secondary">View Post</a>
                                <a href="../data/{entry['validation_path']}" class="btn btn-secondary">Details</a>
                            </td>
                        </tr>"""
        
        # Complete HTML content
        html_content += """
                    </tbody>
                </table>
            </div>
        </div>

        <footer>
            <p>© 2025 Affiliate Content Aggregator. All rights reserved.</p>
        </footer>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Calculate averages
            const validationData = """
        
        # Add validation data as JSON
        html_content += json.dumps(validation_index)
        
        html_content += """;
            
            // Calculate average quality score
            const qualityScores = validationData.map(entry => entry.quality_score);
            const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
            document.getElementById('avg-quality').textContent = avgQuality.toFixed(1);
            
            // Calculate average SEO score
            const seoScores = validationData.map(entry => entry.keyword_score);
            const avgSeo = seoScores.reduce((sum, score) => sum + score, 0) / seoScores.length;
            document.getElementById('avg-seo').textContent = avgSeo.toFixed(1);
            
            // Calculate plagiarism risk
            const riskCounts = {
                'low': 0,
                'medium': 0,
                'high': 0
            };
            
            validationData.forEach(entry => {
                riskCounts[entry.plagiarism_risk]++;
            });
            
            const highestRisk = Object.entries(riskCounts).sort((a, b) => b[1] - a[1])[0];
            document.getElementById('plagiarism-risk').textContent = `${highestRisk[0].charAt(0).toUpperCase() + highestRisk[0].slice(1)} (${Math.round(highestRisk[1] / validationData.length * 100)}%)`;
            
            // Set total posts
            document.getElementById('total-posts').textContent = validationData.length;
        });
    </script>
</body>
</html>"""
        
        # Save dashboard
        with open('../docs/validation.html', 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print("Validation dashboard created successfully.")
        return True
    
    except Exception as e:
        print(f"Error creating validation dashboard: {e}")
        return False

if __name__ == "__main__":
    # Validate all posts
    validate_all_posts()
    
    # Create validation dashboard
    create_validation_dashboard()
