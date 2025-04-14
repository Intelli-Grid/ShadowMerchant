#!/usr/bin/env python3
# scripts/prompt_templates.py

"""
This module contains specialized prompt templates for different product categories.
These templates are used to generate more targeted content based on product type.
"""

# Base template that all category-specific templates will extend
BASE_TEMPLATE = """
Write a comprehensive, SEO-friendly review about {product_title} (price: {product_price}).

Include the following:
1. An engaging introduction that hooks the reader
2. Key features and specifications
3. Benefits of using this product
4. Pros and cons analysis
5. Comparison with similar products
6. Who this product is ideal for
7. A compelling conclusion with a call to action

Use the following keywords naturally throughout the text:
- best {primary_keyword} {current_year}
- {primary_keyword} review
- affordable {primary_keyword}

Format the post in Markdown with proper headings, bullet points, and emphasis where appropriate.
"""

# Technology products template
TECH_TEMPLATE = """
Write a detailed, technical review of {product_title} (price: {product_price}).

Include the following:
1. An engaging introduction highlighting the product's innovation or unique selling point
2. Technical specifications and features (performance metrics, compatibility, etc.)
3. User experience analysis (interface, ease of use, learning curve)
4. Comparison with at least 2 competing products in the same price range
5. Battery life/power efficiency (if applicable)
6. Build quality and durability assessment
7. Value for money analysis
8. Ideal use cases and target audience
9. Pros and cons (minimum 3 of each)
10. Final verdict with a rating out of 10

Use the following keywords naturally throughout the text:
- best {primary_keyword} {current_year}
- {primary_keyword} specs review
- {primary_keyword} vs competitors
- is {primary_keyword} worth it

Format the post in Markdown with proper headings, bullet points, and emphasis where appropriate.
Include a technical specifications table.
"""

# Health and fitness products template
FITNESS_TEMPLATE = """
Write an informative and motivational review of {product_title} (price: {product_price}).

Include the following:
1. An engaging introduction highlighting health/fitness benefits
2. How this product fits into a healthy lifestyle
3. Key features and specifications
4. Scientific evidence or expert opinions supporting its effectiveness (if applicable)
5. Personal experience narrative (hypothetical)
6. Fitness goals this product helps achieve
7. Ease of use and convenience factors
8. Comparison with similar fitness products
9. Pros and cons (minimum 3 of each)
10. Who would benefit most from this product
11. Tips for getting the most out of the product
12. Conclusion with health/fitness motivation

Use the following keywords naturally throughout the text:
- best {primary_keyword} for fitness
- {primary_keyword} health benefits
- {primary_keyword} workout results
- affordable {primary_keyword} fitness

Format the post in Markdown with proper headings, bullet points, and emphasis where appropriate.
"""

# Home and kitchen products template
HOME_TEMPLATE = """
Write a practical and detailed review of {product_title} (price: {product_price}) for home use.

Include the following:
1. An engaging introduction highlighting how this product improves home life
2. Design and aesthetic considerations
3. Key features and specifications
4. Space efficiency and storage requirements
5. Ease of cleaning and maintenance
6. Versatility and multiple use cases
7. Energy efficiency/running costs (if applicable)
8. Noise levels (if applicable)
9. Durability and warranty information
10. Comparison with similar home products
11. Pros and cons (minimum 3 of each)
12. Value for money assessment
13. Conclusion with practical recommendations

Use the following keywords naturally throughout the text:
- best {primary_keyword} for home
- {primary_keyword} home improvement
- space-saving {primary_keyword}
- affordable {primary_keyword} for kitchen/home

Format the post in Markdown with proper headings, bullet points, and emphasis where appropriate.
"""

# Digital products and courses template
DIGITAL_TEMPLATE = """
Write a comprehensive review of {product_title} (price: {product_price}).

Include the following:
1. An engaging introduction highlighting the knowledge/skills gained
2. Course/product structure and content overview
3. Creator credentials and expertise
4. Learning outcomes and benefits
5. Time commitment required
6. User interface and accessibility
7. Support and community features
8. Practical applications of knowledge gained
9. Comparison with similar digital products
10. Who this is ideal for (beginner, intermediate, advanced)
11. Pros and cons (minimum 3 of each)
12. Value for money assessment
13. Conclusion with recommendations

Use the following keywords naturally throughout the text:
- best {primary_keyword} course
- {primary_keyword} learning review
- {primary_keyword} skills development
- affordable {primary_keyword} training

Format the post in Markdown with proper headings, bullet points, and emphasis where appropriate.
"""

def get_template_for_category(category):
    """
    Returns the appropriate template based on product category.
    
    Args:
        category (str): Product category
        
    Returns:
        str: Template string for the specified category
    """
    category = category.lower()
    
    if any(keyword in category for keyword in ['electronics', 'tech', 'gadget', 'computer', 'phone', 'laptop', 'headphone', 'speaker', 'camera']):
        return TECH_TEMPLATE
    
    elif any(keyword in category for keyword in ['fitness', 'health', 'exercise', 'workout', 'vitamin', 'supplement', 'diet', 'yoga']):
        return FITNESS_TEMPLATE
    
    elif any(keyword in category for keyword in ['home', 'kitchen', 'furniture', 'decor', 'appliance', 'garden', 'bedding']):
        return HOME_TEMPLATE
    
    elif any(keyword in category for keyword in ['course', 'ebook', 'digital', 'software', 'online', 'program', 'membership']):
        return DIGITAL_TEMPLATE
    
    # Default to base template if no specific category matches
    return BASE_TEMPLATE

def generate_prompt(product, category=None):
    """
    Generates a specialized prompt for the given product and category.
    
    Args:
        product (dict): Product information
        category (str, optional): Product category. If None, will be inferred from product title
        
    Returns:
        str: Specialized prompt for content generation
    """
    import datetime
    
    # Extract product information
    title = product['title']
    price = product['price']
    
    # Determine primary keyword (usually the first 2-3 words of the product title)
    words = title.split()
    primary_keyword = ' '.join(words[:min(3, len(words))])
    
    # Get current year for SEO purposes
    current_year = datetime.datetime.now().year
    
    # Determine category if not provided
    if not category:
        # Try to infer category from product title
        if any(keyword in title.lower() for keyword in ['electronics', 'tech', 'gadget', 'computer', 'phone', 'laptop', 'headphone', 'speaker', 'camera']):
            category = 'tech'
        elif any(keyword in title.lower() for keyword in ['fitness', 'health', 'exercise', 'workout', 'vitamin', 'supplement', 'diet', 'yoga']):
            category = 'fitness'
        elif any(keyword in title.lower() for keyword in ['home', 'kitchen', 'furniture', 'decor', 'appliance', 'garden', 'bedding']):
            category = 'home'
        elif any(keyword in title.lower() for keyword in ['course', 'ebook', 'digital', 'software', 'online', 'program', 'membership']):
            category = 'digital'
        else:
            category = 'general'
    
    # Get the appropriate template
    template = get_template_for_category(category)
    
    # Format the template with product information
    prompt = template.format(
        product_title=title,
        product_price=price,
        primary_keyword=primary_keyword,
        current_year=current_year
    )
    
    return prompt
