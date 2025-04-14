# Automated Affiliate Content Aggregator

A fully automated system that scrapes affiliate products, generates content using AI, publishes to WordPress/Medium, and tracks earnings through a dashboard - all using free tools and GitHub automation.

## Features

- 🤖 **Automated Content Generation**: Scrapes products and generates SEO-friendly blog posts using AI
- 📊 **Dashboard**: Track earnings, content, and product metrics
- 🔄 **GitHub Actions**: Scheduled daily content generation and publishing
- 💰 **Monetization**: Amazon Associates affiliate links
- 🌐 **Publishing**: Publish to WordPress

## Project Structure

```
Automated_Affiliate_Content_Aggregator/
├── .github/
│   └── workflows/
│       └── main.yml         # GitHub Actions workflow
├── docs/
│   ├── data/                # JSON data files
│   ├── posts/               # Generated blog posts
│   ├── index.html           # Dashboard HTML
│   ├── styles.css           # Dashboard styles
│   └── script.js            # Dashboard JavaScript
├── scripts/
│   ├── scraper.py           # Product scraping script
│   ├── generator.py         # Content generation script
│   └── publisher.py         # Content publishing script
└── README.md                # Project documentation
```

## Setup Instructions

### Prerequisites

- GitHub account
- Python 3.8+
- Groq API key (free tier available)
- WordPress site with REST API enabled (optional)
- Medium account with API token (optional)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/Automated_Affiliate_Content_Aggregator.git
cd Automated_Affiliate_Content_Aggregator
```

2. **Install dependencies**

```bash
pip install -r requirements.txt
```

3. **Create environment variables**

Create a `.env` file in the root directory with the following variables:

```
GROQ_API_KEY=your_groq_api_key
GROQ_API_BASE=https://api.groq.com/openai/v1
WP_URL=your_wordpress_site_url
WP_USERNAME=your_wordpress_username
WP_PASSWORD=your_wordpress_application_password
AMAZON_AFFILIATE_ID=your-amazon-affiliate-id

# Email Configuration (for newsletters)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=Your Name <your_email@gmail.com>

# SEO Configuration
SITE_NAME=Your Site Name
SITE_URL=https://yourdomain.com
SITE_LOGO=https://yourdomain.com/logo.png
SITE_AUTHOR=Your Name
```

4. **Configure GitHub repository**

- Push the code to your GitHub repository
- Add the environment variables as GitHub Secrets
- Enable GitHub Pages for the `docs` folder

### Usage

#### Manual Execution

Run the scripts manually to test:

```bash
cd scripts
python scraper.py      # Scrape products
python generator.py    # Generate content
python publisher.py    # Publish content
```

#### Automated Execution

The GitHub Actions workflow will run daily at 12 PM UTC. You can also trigger it manually from the Actions tab in your GitHub repository.

## Dashboard

The dashboard is hosted on GitHub Pages and provides:

- Earnings metrics
- Content statistics
- Product tracking
- Performance charts

Access it at: `https://yourusername.github.io/Automated_Affiliate_Content_Aggregator/`

## Monetization Strategy

1. **Affiliate Links**:

   - Replace placeholder URLs with your Amazon Associates affiliate links
   - Earn 3-10% commission per sale (depending on product category)

2. **Ad Revenue**:
   - Add Google AdSense to your blog (once traffic hits 500+ views/month)

## Customization

- **Product Categories**: Edit the search queries in `scraper.py`
- **Content Style**: Modify the prompts in `generator.py`
- **Publishing Platforms**: Configure in `publisher.py`
- **Dashboard Design**: Customize `index.html` and `styles.css`

## Challenges & Solutions

- **API Rate Limits**: The scripts include rate limiting and user-agent rotation
- **SEO Optimization**: AI prompts include SEO best practices
- **Affiliate Compliance**: Disclosure statements are automatically added

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This project is for educational purposes only. Be sure to comply with the terms of service for all platforms and APIs used.

## Acknowledgements

- Groq for the content generation API
- GitHub for hosting and automation
- Amazon Associates and ClickBank for affiliate programs
