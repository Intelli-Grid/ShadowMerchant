# ShadowMerchant

A fully automated deal discovery platform for Indian shoppers — aggregating, scoring, and broadcasting the best discounts from Amazon, Flipkart, Myntra, Meesho, and Nykaa in one place.

**Live at → [shadowmerchant.online](https://www.shadowmerchant.online)**

---

## Stack

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| **Backend** | Next.js API Routes, MongoDB Atlas, Upstash Redis |
| **Auth** | Clerk |
| **Search** | Algolia |
| **Payments** | Razorpay (Pro subscriptions) |
| **Notifications** | Telegram Bot, OneSignal (push), Brevo (email) |
| **Scrapers** | Python 3.11 — Playwright, curl_cffi, requests |
| **AI Scoring** | Groq (deal scoring & description enrichment) |
| **Media** | Cloudinary (image CDN) |
| **Deployment** | Vercel (web), Windows Task Scheduler (scrapers) |

---

## Project Structure

```
apps/
  web/                 # Next.js frontend & API routes
    src/app/
      (public)/        # Homepage, deals feed, deal detail
      (auth)/          # Login, signup
      admin/           # Admin dashboard
      api/             # REST API endpoints
    src/lib/           # MongoDB, Redis, Algolia, Clerk helpers
    src/models/        # Mongoose schemas (Deal, User, PriceHistory)

scripts/               # Python scraper pipeline (runs locally on Windows)
  scrapers/            # Per-platform scrapers
    amazon_scraper.py  # Playwright Chromium (headless=False on Windows)
    flipkart_scraper.py# Official affiliate API (needs credentials)
    meesho_scraper.py  # JSON API via direct residential IP
    myntra_scraper.py  # curl_cffi + window.__myx extraction
    nykaa_scraper.py   # curl_cffi + __PRELOADED_STATE__ extraction
  processors/          # Deal scoring, dedup, price tracking, image processing
  social/              # Telegram poster, Twitter/X poster
  notifiers/           # Push, email, alert dispatch
  scheduler.py         # Master pipeline orchestrator
  auto_run.bat         # Windows Task Scheduler entry point (2-pass, OOM-safe)
  run_local.bat        # One-click manual pipeline runner
  .env                 # All API keys and credentials (never commit)
  requirements.txt     # Python dependencies
```

---

## Scraper Pipeline (Local Windows Machine)

Scrapers run **locally** on your Windows machine via Windows Task Scheduler — NOT on Render.  
This uses your home residential IP which is unblocked by all platforms.

### Automatic (set-and-forget)
- **07:00 IST** and **21:00 IST** daily via Task Scheduler
- Runs silently, logs to `scripts/pipeline_auto.log`

### Manual (run now)
```bat
scripts\run_local.bat
```

### Single scraper (for testing/debugging)
```powershell
cd scripts
..\.venv\Scripts\python.exe scheduler.py --run-now --scrapers nykaa
..\.venv\Scripts\python.exe scheduler.py --run-now --scrapers amazon
..\.venv\Scripts\python.exe scheduler.py --run-now --scrapers meesho myntra nykaa
```

### Data flow
```
Local scrapers → MongoDB Atlas → Algolia (search) → Vercel ISR (3 min) → shadowmerchant.online
                              → Telegram @ShadowMerchantDeals (hot deals)
                              → Admin Telegram (pipeline report)
```

---

## Getting Started (Web App Dev)

```bash
# Install dependencies
pnpm install

# Copy env template
cp apps/web/.env.example apps/web/.env.local
# Fill in your keys

# Run development server
pnpm dev
```

## Getting Started (Scrapers)

```bash
# Create virtual environment
cd shadow-merchant
python -m venv .venv

# Activate and install
.venv\Scripts\activate
pip install -r scripts/requirements.txt

# Install Playwright browser
python -m playwright install chromium

# Copy and fill .env
cp scripts/.env.example scripts/.env

# Run pipeline
python scripts/scheduler.py --run-now
```

---

## Scraper Status (Aug 2026)

| Platform | Status | Deals/Run | Notes |
|---|---|---|---|
| Nykaa | ✅ Working | ~119 | Direct IP |
| Meesho | ✅ Working | ~480 | Direct IP |
| Myntra | ✅ Working | ~313 | Direct IP |
| Amazon | ✅ Working | ~214 | Playwright headless=False |
| Flipkart | ⚠️ Pending | 0 | Needs affiliate creds in .env |

---

## Deployment

- **Web app**: Deployed on Vercel. Configure environment variables in Vercel dashboard.
- **Scrapers**: Run locally on Windows. Windows Task Scheduler handles automation.
- **Render**: Used only for Flask health-check endpoint (NOT for scrapers).

---

## Environment Variables

See `scripts/.env` (scrapers) and `apps/web/.env.local` (web app) for full variable reference.  
**Never commit either file.**
