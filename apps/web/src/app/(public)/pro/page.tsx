import { Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { RazorpayButton } from '@/components/pro/RazorpayButton';

const PRO_FEATURES = [
  '📊 Full 30-day price history on every deal',
  '⚡ Deal Alerts (up to 10 rules)',
  '📉 Price drop notifications on wishlisted deals',
  '💛 Unlimited wishlist',
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
          Know when to buy. <br />
          <span className="heading-gold">Never overpay again.</span>
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Pro gives you the intelligence layer on top of India's best deal feed. See price history, set alerts, get notified — all for less than your last impulse buy.
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
            <h2 className="text-xl font-bold text-white mb-1">Pro</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>For serious deal hunters</p>
          </div>

          <div className="mb-8">
            <span className="text-4xl font-black text-white price-display">₹99</span>
            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>/ month</span>
            <p className="text-sm font-bold mt-1" style={{ color: 'var(--score-high)' }}>
              Save 33% with annual plan (₹799/year)
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Less than one cup of Starbucks.<br/>
              Less than one month of Netflix.<br/>
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
                Save 33% · Annual Plan
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                ₹799/year · Just ₹66/month
              </p>
            </div>
            <RazorpayButton plan="annual" className="!py-2 !px-5 text-sm" />
          </div>

          <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            Cancel anytime. Powered by Razorpay.
          </p>
        </div>
      </div>

      {/* Social Proof / Live Stats */}
      <div className="mb-16 rounded-2xl p-8" style={{ background: 'var(--gold-glow)', border: '1px solid var(--gold-border)' }}>
        <h2 className="text-2xl font-bold text-white mb-8 section-heading text-center justify-center border-none" style={{ fontFamily: 'var(--font-display)' }}>
          Join the Intelligence Layer
        </h2>
        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          <div className="text-center">
            <p className="text-4xl font-black mb-1 price-display" style={{ color: 'var(--gold)' }}>12,400+</p>
            <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Active Deals</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-black mb-1 price-display" style={{ color: 'var(--gold)' }}>₹1.8Cr</p>
            <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Savings Tracked</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-black mb-1 price-display" style={{ color: 'var(--gold)' }}>5+</p>
            <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Platforms Tracked</p>
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
            { q: 'What is the difference between Free and Pro?', a: 'Free gives you full access to all deals, categories, and direct store links. Pro gives you the intelligence layer: 30-day pricing history charts, background price-drop alerts, and unlimited wishlists to ensure you never miss a lightning deal.' },
            { q: 'Are deals locked anymore?', a: "No! All deals, links, and content are now 100% free and open. Pro gives you the intelligence layer—pricing history, custom deal alerts, and drop notifications—so you know *when* to buy." },
            { q: 'How does billing work?', a: 'We use Razorpay for secure Indian payments. You can pay via UPI, credit/debit card, or net banking. You\'re billed monthly or annually depending on your choice.' },
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

    </main>
  );
}
