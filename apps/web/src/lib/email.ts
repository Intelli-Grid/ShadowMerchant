/**
 * ShadowMerchant — Email Service
 * src/lib/email.ts
 *
 * Uses Brevo (@getbrevo/brevo) for transactional emails.
 * Required Vercel env vars:
 *   BREVO_API_KEY        — same key already in scripts/.env BREVO_API_KEY
 *   BREVO_SENDER_EMAIL   — e.g. deals@shadowmerchant.online
 *
 * Lazy-initialised: missing API key logs a warning but NEVER crashes a route.
 */
import { BrevoClient } from '@getbrevo/brevo';

const _rawUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.shadowmerchant.online'
const APP_URL  = (_rawUrl.startsWith('http://localhost') ? 'https://www.shadowmerchant.online' : _rawUrl).replace(/\/$/, '')
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? 'deals@shadowmerchant.online'
const SENDER_NAME  = process.env.BREVO_SENDER_NAME  ?? 'ShadowMerchant'

// ── Lazy Brevo client ───────────────────────────────────────────────────────
let _client: BrevoClient | null = null

function getBrevoClient(): BrevoClient | null {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    console.warn('[SM Email] BREVO_API_KEY not set — email skipped')
    return null
  }
  if (!_client) {
    _client = new BrevoClient({ apiKey })
  }
  return _client
}

// ── Core send helper ────────────────────────────────────────────────────────
async function sendEmail(to: string, toName: string, subject: string, html: string): Promise<boolean> {
  const client = getBrevoClient()
  if (!client) return false
  try {
    await client.transactionalEmails.sendTransacEmail({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    })
    console.log(`[SM Email] Sent "${subject}" to ${to}`)
    return true
  } catch (err: any) {
    console.error('[SM Email] Send failed:', err?.message ?? err)
    return false
  }
}

// ── Shared wrapper ────────────────────────────────────────────────────────────
function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>ShadowMerchant</title>
</head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#1a1a24;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
    <div style="background:linear-gradient(135deg,#6d28d9 0%,#4c1d95 100%);padding:36px 28px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">ShadowMerchant</div>
      <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:6px;">India's Smartest Deal Hunter</div>
    </div>
    <div style="padding:32px 28px;color:#e2e8f0;">${content}</div>
    <div style="padding:20px 28px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
      <p style="color:#64748b;font-size:12px;margin:0;">
        You received this because you signed up on ShadowMerchant.<br>
        <a href="${APP_URL}" style="color:#8b5cf6;text-decoration:none;">Visit site</a>
        &nbsp;|&nbsp;
        <a href="${APP_URL}/dashboard/settings" style="color:#8b5cf6;text-decoration:none;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Welcome email — called immediately after user.created Clerk webhook.
 * Fire-and-forget: caller should not await if it might slow the response.
 */
export async function sendWelcomeEmail(email: string, firstName?: string): Promise<boolean> {
  const name = firstName?.trim() || 'there'
  const html = wrap(`
    <h2 style="color:#f1f5f9;font-size:22px;margin:0 0 8px;">Welcome, ${name}! </h2>
    <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">
      You're on ShadowMerchant. We find the best deals on Amazon, Flipkart, Meesho, 
      Myntra and Nykaa — scored by our algorithm so you never have to guess whether 
      a discount is actually real.
    </p>
    <div style="background:rgba(109,40,217,0.08);border:1px solid rgba(109,40,217,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;color:#c4b5fd;margin-bottom:12px;">3 things to do right now:</div>
      <ol style="color:#94a3b8;font-size:14px;line-height:2;padding-left:20px;margin:0;">
        <li>Browse <a href="${APP_URL}/deals" style="color:#8b5cf6;">today's top deals</a> — scored 0-100 for quality</li>
        <li>Set alerts for categories you care about in <a href="${APP_URL}/dashboard/alerts" style="color:#8b5cf6;">Alert Settings</a></li>
        <li>Join our <a href="https://t.me/ShadowMerchantDeals" style="color:#8b5cf6;">Telegram channel</a> or <a href="https://whatsapp.com/channel/0029Vb7dimp1XquQpiaSWQ1N" style="color:#25D366;">WhatsApp channel</a> for instant flash deal alerts</li>
      </ol>
    </div>
    <div style="background:#111827;border-radius:12px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;color:#64748b;margin-bottom:10px;letter-spacing:0.05em;">HOW THE SHADOW SCORE WORKS</div>
      <div>
        <span style="background:rgba(34,197,94,0.1);color:#22c55e;padding:4px 12px;border-radius:20px;font-size:12px;margin-right:6px;">80+ Essential Grab</span>
        <span style="background:rgba(245,158,11,0.1);color:#f59e0b;padding:4px 12px;border-radius:20px;font-size:12px;margin-right:6px;">60-79 Fair Price</span>
        <span style="background:rgba(239,68,68,0.1);color:#ef4444;padding:4px 12px;border-radius:20px;font-size:12px;">Under 60 Skip It</span>
      </div>
    </div>
    <a href="${APP_URL}/deals"
       style="display:block;background:linear-gradient(135deg,#7c3aed,#4c1d95);color:#fff;text-align:center;padding:14px 24px;border-radius:10px;font-weight:600;font-size:15px;text-decoration:none;margin-bottom:20px;">
      See Today's Deals
    </a>
    <p style="color:#475569;font-size:13px;line-height:1.6;margin:0;">
      <strong style="color:#94a3b8;">Want real-time WhatsApp alerts + price history charts?</strong><br>
      Upgrade to <a href="${APP_URL}/pro" style="color:#8b5cf6;">ShadowMerchant Pro</a> for the full experience.
    </p>
  `)
  return sendEmail(email, name, 'Welcome to ShadowMerchant — Your Deal Feed is Ready', html)
}

/**
 * Pro activation confirmation — call from Razorpay webhook after subscription.activated.
 */
export async function sendProConfirmationEmail(
  email: string,
  firstName?: string,
  planLabel?: string
): Promise<boolean> {
  const name = firstName?.trim() || 'there'
  const html = wrap(`
    <h2 style="color:#f1f5f9;font-size:22px;margin:0 0 8px;">You are now ShadowMerchant Pro!</h2>
    <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Your <strong style="color:#c4b5fd;">${planLabel ?? 'Pro'}</strong> subscription is active. Here is what you unlocked:
    </p>
    <ul style="color:#94a3b8;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
      <li>Price history charts on every deal</li>
      <li>AI Buy Now or Wait verdict</li>
      <li>Real-time WhatsApp deal alerts (link your number in settings)</li>
      <li>Exclusive Pro-only deals hidden from free users</li>
      <li>Flash deal alerts before they go public</li>
    </ul>
    <a href="${APP_URL}/dashboard"
       style="display:block;background:linear-gradient(135deg,#7c3aed,#4c1d95);color:#fff;text-align:center;padding:14px 24px;border-radius:10px;font-weight:600;font-size:15px;text-decoration:none;">
      Go to Pro Dashboard
    </a>
  `)
  return sendEmail(email, name, 'ShadowMerchant Pro is Active', html)
}

/**
 * ARCH-01: Deal alert email — called from trigger_alerts.py (Python → Next.js API)
 * when a Pro user has no Telegram/WhatsApp linked but has an active alert that matched.
 *
 * Also used as a FALLBACK for all alert types: even if Telegram was sent, a Pro user
 * with email opted-in also gets the email.
 *
 * @param email   - recipient email address
 * @param firstName - user's first name (optional)
 * @param deal    - the matching deal object
 * @param alertType - human-readable type label for the email subject
 */
export async function sendDealAlertEmail(
  email: string,
  firstName: string | undefined,
  deal: {
    title: string
    discounted_price: number
    original_price?: number
    discount_percent?: number
    deal_score?: number
    source_platform?: string
    slug?: string
    _id?: string
  },
  alertType: string = 'price alert'
): Promise<boolean> {
  const name       = firstName?.trim() || 'there'
  const dealUrl    = `${APP_URL}/api/go/${deal._id ?? deal.slug}?utm_source=email&utm_medium=alert&utm_campaign=deal_alert`
  const detailUrl  = `${APP_URL}/deals/${deal.slug ?? deal._id}`
  const savings    = deal.original_price && deal.original_price > deal.discounted_price
    ? `₹${(deal.original_price - deal.discounted_price).toLocaleString('en-IN')}`
    : null
  const scoreColor = (deal.deal_score ?? 0) >= 80 ? '#22c55e' : (deal.deal_score ?? 0) >= 60 ? '#f59e0b' : '#94a3b8'
  const scoreLabel = (deal.deal_score ?? 0) >= 80 ? 'Great Deal' : (deal.deal_score ?? 0) >= 60 ? 'Good Deal' : 'Fair Deal'
  const platform   = deal.source_platform
    ? deal.source_platform.charAt(0).toUpperCase() + deal.source_platform.slice(1)
    : 'Store'

  const html = wrap(`
    <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 6px;">🔔 Your ${alertType} matched!</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Hi ${name}, a deal you set an alert for just hit your target.</p>

    <div style="background:#111827;border-radius:14px;padding:20px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:15px;font-weight:600;color:#e2e8f0;line-height:1.5;margin-bottom:16px;">${deal.title}</div>

      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px;flex-wrap:wrap;">
        <span style="font-size:28px;font-weight:800;color:#f1f5f9;">₹${deal.discounted_price.toLocaleString('en-IN')}</span>
        ${deal.original_price ? `<span style="font-size:16px;color:#475569;text-decoration:line-through;">₹${deal.original_price.toLocaleString('en-IN')}</span>` : ''}
        ${deal.discount_percent ? `<span style="background:rgba(34,197,94,0.1);color:#22c55e;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600;">${Math.round(deal.discount_percent)}% OFF</span>` : ''}
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
        ${deal.deal_score != null ? `<span style="background:rgba(0,0,0,0.3);border:1px solid ${scoreColor}33;color:${scoreColor};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Shadow Score: ${deal.deal_score}/100 · ${scoreLabel}</span>` : ''}
        ${savings ? `<span style="background:rgba(109,40,217,0.1);color:#c4b5fd;padding:4px 12px;border-radius:20px;font-size:12px;">You save ${savings}</span>` : ''}
        <span style="background:rgba(255,255,255,0.05);color:#64748b;padding:4px 12px;border-radius:20px;font-size:12px;">on ${platform}</span>
      </div>

      <a href="${dealUrl}"
         style="display:block;background:linear-gradient(135deg,#7c3aed,#4c1d95);color:#fff;text-align:center;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:10px;">
        🛒 Grab This Deal Now
      </a>
      <a href="${detailUrl}"
         style="display:block;background:rgba(255,255,255,0.04);color:#8b5cf6;text-align:center;padding:10px 24px;border-radius:10px;font-size:13px;text-decoration:none;border:1px solid rgba(139,92,246,0.2);">
        📊 View Price History &amp; Score Breakdown
      </a>
    </div>

    <p style="color:#475569;font-size:12px;line-height:1.6;margin:0;">
      This alert was triggered because a deal matched your <strong style="color:#64748b;">${alertType}</strong> criteria.
      Manage your alerts in <a href="${APP_URL}/dashboard/alerts" style="color:#8b5cf6;">Alert Settings</a>.
      To get instant notifications via Telegram or WhatsApp, link your account in
      <a href="${APP_URL}/dashboard/settings" style="color:#8b5cf6;">Notification Settings</a>.
    </p>
  `)

  const subject = `🔔 Alert: ${deal.title.slice(0, 60)}${deal.title.length > 60 ? '…' : ''} — ₹${deal.discounted_price.toLocaleString('en-IN')} on ${platform}`
  return sendEmail(email, name, subject, html)
}

