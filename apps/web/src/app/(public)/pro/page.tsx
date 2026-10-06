import type { Metadata } from 'next';
import { Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { RazorpayButton } from '@/components/pro/RazorpayButton';

export const metadata: Metadata = {
  title: 'ShadowMerchant Pro — Target Price Alerts & Price History',
  description: 'Upgrade to ShadowMerchant Pro for ₹199/month. Get target price alerts, observed price history, and wishlist tracking across Amazon, Myntra & Nykaa.',
  openGraph: {
    title: 'ShadowMerchant Pro — Price Alerts & History',
    description: 'Set your price. We watch it. Get alerted the moment it drops — ₹199/month or ₹1,799/year.',
    url: 'https://www.shadowmerchant.online/pro',
    type: 'website',
  },
  alternates: { canonical: 'https://www.shadowmerchant.online/pro' },
};


const PRO_FEATURES = [
  '🔔 Target Price Alerts — set your price, we watch until it drops',
  '📊 Know if today’s price is actually a good price (observed price history)',
  '⚡ Flash sale alerts before deals sell out (up to 10 rules)',
  '💛 Wishlist tracking — up to 200 products',
  '📬 Priority support',
];

const FREE_FEATURES = [
  'Browse all deals — unlimited',
  'Click any affiliate deal link',
  'Search across all deals',
  'Save up to 5 deals to wishlist',
  'All 12 categories',
];

export default function ProPage() {
  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

      {/* Header */}
      <div className="text-center mb-16">
        {/* Logo mark */}
        <div className="flex justify-center mb-6">
          <div
            className="relative w-20 h-20"
            style={{ filter: 'drop-shadow(0 0 16px rgba(201,168,76,0.4))' }}
          >
            <Image src="/logo.png" alt="ShadowMerchant" fill className="object-contain" priority />
          </div>
        </div>

        <Badge
          className="mb-4 font-bold px-4 py-1.5"
          style={{
            background: 'var(--gold-dim)',
            color: 'var(--gold)',
            border: '1px solid var(--gold-border)',
          }}
          variant="secondary"
        >
          ✦ Pro Membership
        </Badge>

        <h1
          className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Set your price.{' '}<br />
          <span className="heading-gold">We watch. You buy right.</span>
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Stop guessing. Pro tells you if today’s deal is actually a good price — and alerts you the moment a product you’re watching hits your target.
        </p>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">

        {/* Free Plan */}
        <div
          className="rounded-2xl p-8 flex flex-col"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--sm-border)',
          }}
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">Free</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Great for casual deal hunters</p>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-black text-white price-display">₹0</span>
            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>/ forever</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                {f}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            className="w-full font-bold h-12"
            style={{ borderColor: 'var(--sm-border)', color: 'var(--text-secondary)' }}
          >
            Current Plan
          </Button>
        </div>

        {/* Pro Plan */}
        <div
          className="relative rounded-2xl p-8 flex flex-col overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-overlay) 100%)',
            border: '1px solid var(--gold-border)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.08)',
          }}
        >
          {/* Gold glow in corner */}
          <div
            className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none"
            style={{ background: 'var(--gold)' }}
          />

          {/* Gold left accent */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ background: 'linear-gradient(to bottom, var(--gold-bright), var(--gold))' }}
          />

          {/* Popular Badge */}
          <div
            className="absolute top-6 right-6 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1"
            style={{ background: 'var(--gold)', color: '#0A0A0A' }}
          >
            <Zap className="w-3 h-3" /> Most Popular
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">ShadowMerchant Pro</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>For buyers who want to buy at the right time</p>
          </div>

          <div className="mb-8">
            <span className="text-4xl font-black text-white price-display">₹199</span>
            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>/ month</span>
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Billed monthly. Cancel anytime.
            </p>
          </div>

          <ul className="space-y-3 mb-8 flex-1">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
                {f}
              </li>
            ))}
          </ul>

          {/* CTA — wires to Razorpay */}
          <RazorpayButton plan="monthly" className="w-full" />

          {/* Annual Plan CTA */}
          <div
            className="mt-3 rounded-xl p-4 flex items-center justify-between"
            style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)' }}
          >
            <div>
              <p className="text-sm font-black" style={{ color: 'var(--gold)' }}>
                Annual Plan — Save 25%
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                ₹1,799/year · billed once · no auto-renewal
              </p>
            </div>
            <RazorpayButton plan="annual" className="!py-2 !px-5 text-sm" />
          </div>

          <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            Monthly plan: cancel anytime. Annual plan: billed once, no automatic renewal. Powered by Razorpay.
          </p>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="mb-16 rounded-2xl p-8" style={{ background: 'var(--gold-glow)', border: '1px solid var(--gold-border)' }}>
        <h2 className="text-2xl font-bold text-white mb-6 section-heading text-center justify-center border-none" style={{ fontFamily: 'var(--font-display)' }}>
          The Intelligence Layer
        </h2>
        <div className="flex flex-col gap-4 max-w-xl mx-auto">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📉</span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <strong className="text-white">Stop guessing if it's a real deal.</strong> We track observed prices over time so you can see if today's discount is genuine — or just a padded MRP.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔔</span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <strong className="text-white">Set your price. Walk away.</strong> Pro monitors your target products 3× daily and alerts you the moment the price drops to your number.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <strong className="text-white">Never miss a flash sale.</strong> Lightning deals sell out in minutes. Get alerted before they're gone.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div
        className="rounded-2xl p-8"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
      >
        <h2
          className="text-2xl font-bold text-white mb-8 section-heading"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {[
            { q: 'What is the difference between Free and Pro?', a: 'Free gives you full access to all deals, categories, and direct store links, plus up to 5 wishlist saves. Pro gives you the intelligence layer: 30-day pricing history charts, background price-drop alerts, and up to 200 wishlist saves so you can track an entire shopping list.' },
            { q: 'Are deals locked anymore?', a: "No! All deals, links, and content are now 100% free and open. Pro gives you the intelligence layer—pricing history, custom deal alerts, and drop notifications—so you know *when* to buy." },
            { q: 'How does billing work?', a: 'We use Razorpay for secure Indian payments. You can pay via UPI, credit/debit card, or net banking. Monthly plan is ₹199/month and recurs automatically each month until you cancel. Annual plan is ₹1,799/year, billed once — it does not auto-renew. You will receive a renewal reminder email before your annual subscription ends, and you can renew manually at any time from the /pro page.' },
            { q: 'Can I cancel anytime?', a: 'Yes, absolutely. You can cancel your subscription from your Dashboard at any time. Your Pro benefits remain active until the end of the current billing period.' },
            { q: 'Do deals expire?', a: "Yes! Flash and lightning deals are time-limited by the platforms themselves. We timestamp all deals when scraped, but we can't guarantee a price is still live when you click." },
          ].map(({ q, a }) => (
            <div key={q} className="pb-6 last:pb-0" style={{ borderBottom: '1px solid var(--sm-border)' }}>
              <h3 className="font-bold text-white mb-2">{q}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp Soft-Exit CTA — for visitors who didn't convert to Pro */}
      <div
        className="mt-8 rounded-2xl px-8 py-7 text-center"
        style={{
          background: 'linear-gradient(135deg, #071A0B 0%, #0A2210 100%)',
          border: '1px solid rgba(37,211,102,0.18)',
        }}
      >
        <p className="text-white font-bold text-base mb-1">
          Not ready to commit? That&apos;s totally fine.
        </p>
        <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Get our daily deal digest on WhatsApp for free — algorithmically scored deals, delivered to your phone.
        </p>
        <a
          href="https://whatsapp.com/channel/0029Vb7dimp1XquQpiaSWQ1N"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
          style={{ background: '#25D366', color: 'white' }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="white" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Follow Free →
        </a>
        <p className="text-[10px] italic mt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Free forever · Reply STOP to opt out
        </p>
      </div>

    </main>
  );
}
