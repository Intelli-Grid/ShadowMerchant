# ShadowMerchant

A deal discovery platform for Indian shoppers — aggregating the best discounts from Amazon, Flipkart, Myntra, Meesho, Nykaa, and Croma in one place.

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, MongoDB, Redis (Upstash)
- **Auth**: Clerk
- **Search**: Algolia
- **Payments**: Razorpay
- **Notifications**: OneSignal, Brevo (Email), Telegram
- **Scrapers**: Python (Playwright, BeautifulSoup, requests)
- **AI**: Groq (deal scoring & summaries)
- **Media**: Cloudinary

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy env template
cp apps/web/.env.example apps/web/.env.local

# Run development server
pnpm dev
```

## Project Structure

```
apps/
  web/          # Next.js frontend & API
scripts/
  scrapers/     # Platform scrapers (Amazon, Flipkart, Myntra, etc.)
  processors/   # Deal scoring, image processing, price tracking
  notifiers/    # Push, email, Telegram notifications
  social/       # Twitter/Telegram posting
```

## Deployment

Deployed on Vercel. Environment variables must be configured in the Vercel dashboard before deployment.
