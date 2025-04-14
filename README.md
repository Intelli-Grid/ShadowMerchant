# Automated Affiliate Content Aggregator

A fully automated system that scrapes affiliate products, generates content using AI, publishes to WordPress/Medium, and tracks earnings through a dashboard - all using free tools and GitHub automation.

## Features

- 🤖 **Automated Content Generation**: Scrapes products and generates SEO-friendly blog posts using AI
- 📊 **Dashboard**: Track earnings, content, and product metrics
- 🔄 **GitHub Actions**: Scheduled daily content generation and publishing
- 💰 **Monetization**: Amazon Associates and ClickBank affiliate links
- 🌐 **Multi-Platform**: Publish to WordPress, Medium, or both

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
- OpenAI API key (free tier available)
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
pip install requests beautifulsoup4 openai python-dotenv
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
- Add the environment variables as GitHub Secrets (see below)
- Enable GitHub Pages for the `docs` folder

### Setting Up GitHub Secrets

For the GitHub Actions workflow to run properly, you need to add the following secrets to your repository:

1. Go to your repository on GitHub
2. Click on "Settings" → "Secrets and variables" → "Actions"
3. Click on "New repository secret"
4. Add the following secrets:

| Secret Name           | Description                         | Example Value                      |
| --------------------- | ----------------------------------- | ---------------------------------- |
| `GROQ_API_KEY`        | Your Groq API key                   | gsk_abc123...                      |
| `GROQ_API_BASE`       | Groq API base URL                   | https://api.groq.com/openai/v1     |
| `AMAZON_AFFILIATE_ID` | Your Amazon affiliate ID            | yourname-20                        |
| `WP_URL`              | Your WordPress site URL             | https://yoursite.com/wp-json/wp/v2 |
| `WP_USERNAME`         | Your WordPress username             | admin                              |
| `WP_PASSWORD`         | Your WordPress application password | xxxx xxxx xxxx xxxx                |
| `EMAIL_HOST`          | Your email SMTP host                | smtp.gmail.com                     |
| `EMAIL_PORT`          | Your email SMTP port                | 587                                |
| `EMAIL_USER`          | Your email username                 | your.email@gmail.com               |
| `EMAIL_PASSWORD`      | Your email password or app password | abcd efgh ijkl mnop                |
| `EMAIL_FROM`          | Your email from address             | Your Name <your.email@gmail.com>   |
| `SITE_NAME`           | Your site name                      | Affiliate Reviews                  |
| `SITE_URL`            | Your site URL                       | https://yoursite.com               |
| `SITE_LOGO`           | Your site logo URL                  | https://yoursite.com/logo.png      |
| `SITE_AUTHOR`         | Your site author name               | Your Name                          |

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

The GitHub Actions workflow will run daily at 12 PM UTC. You can also trigger it manually:

1. Go to your repository on GitHub
2. Click on the "Actions" tab
3. Select the "Daily Content Automation" workflow
4. Click on "Run workflow" → "Run workflow"

The workflow will:

1. Scrape products from Amazon
2. Generate content using Groq AI
3. Validate and optimize the content for SEO
4. Publish to WordPress
5. Generate a newsletter (if configured)
6. Update the dashboard with new data

## Dashboard

The dashboard is hosted on GitHub Pages and provides:

- Earnings metrics
- Content statistics
- Product tracking
- Performance charts

Access it at: `https://yourusername.github.io/ShadowMerchant/`

## Monetization Strategy

1. **Affiliate Links**:

   - Replace placeholder URLs with your Amazon Associates affiliate links
   - Earn 3-10% commission per sale (depending on product category)

2. **Ad Revenue**:
   - Add Google AdSense to your blog (once traffic hits 500+ views/month)

## Customization

- **Product Categories**: Edit the search queries in `scraper.py`
- **Content Style**: Modify the prompts in `generator.py`
- **WordPress Settings**: Configure in `publisher.py`
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

- OpenAI for the content generation API
- GitHub for hosting and automation
- Amazon Associates and ClickBank for affiliate programs
