import { Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RazorpayButton } from '@/components/pro/RazorpayButton';

const PRO_FEATURES = [
  'Access to all Pro Exclusive deals (highest savings)',
  'Deal Alerts — get notified instantly on Telegram & WhatsApp',
  'Unlimited Deal Wishlisting',
  'Price Drop Notifications on tracked products',
  'Early access to flash & lightning deals',
  'No ads, ever',
  'Advanced filters (min discount, max price, brand)',
  'Priority email support',
];

const FREE_FEATURES = [
  'Browse 20+ new deals daily',
  'All public deals from Amazon, Flipkart & more',
  'Deal Score ranking (AI-powered)',
  '5 wishlist slots',
];

export default function ProPage() {
  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

      {/* Header */}
      <div className="text-center mb-16">
        <Badge className="mb-4 bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/30 font-bold px-4 py-1.5" variant="secondary">
          Pro Membership
        </Badge>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
          Stop missing the best deals. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] to-[#FF6B00]">Go Pro.</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto">
          Pro members get access to exclusive high-discount deals, instant alerts and smart price tracking — all for less than a cup of chai.
        </p>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">

        {/* Free Plan */}
        <div className="bg-[#13131A] border border-[#2A2A35] rounded-2xl p-8 flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">Free</h2>
            <p className="text-gray-500 text-sm">Great for casual deal hunters</p>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-black text-white">₹0</span>
            <span className="text-gray-500 ml-2">/ forever</span>
          </div>
          <ul className="space-y-3 mb-8 flex-1">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-gray-400 text-sm">
                <Check className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full border-[#2A2A35] text-gray-400 hover:border-white hover:text-white font-bold h-12">
            Current Plan
          </Button>
        </div>

        {/* Pro Plan */}
        <div className="relative bg-gradient-to-b from-[#1A1024] to-[#13131A] border border-[#7C3AED]/50 rounded-2xl p-8 flex flex-col shadow-xl shadow-[#7C3AED]/10 overflow-hidden">
          {/* Popular Badge */}
          <div className="absolute top-6 right-6 bg-[#7C3AED] text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3" /> Most Popular
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">Pro</h2>
            <p className="text-gray-400 text-sm">For serious deal hunters</p>
          </div>

          <div className="mb-8">
            <span className="text-4xl font-black text-white">₹299</span>
            <span className="text-gray-500 ml-2">/ month</span>
            <p className="text-sm text-[#00C853] font-bold mt-1">Save 40% with annual plan (₹2,099/year)</p>
          </div>

          <ul className="space-y-3 mb-8 flex-1">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-gray-300 text-sm">
                <Check className="w-4 h-4 text-[#7C3AED] mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {/* CTA — wires to Razorpay */}
          <RazorpayButton plan="monthly" className="w-full" />
          <p className="text-center text-gray-600 text-xs mt-4">Cancel anytime. Powered by Razorpay.</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-[#13131A] border border-[#2A2A35] rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {[
            { q: 'What counts as a Pro Exclusive deal?', a: 'Deals with a ShadowMerchant AI Score of 85 or above are locked for Pro members — these are the most significant price drops we detect, usually 50–80% off retail price.' },
            { q: 'How does billing work?', a: 'We use Razorpay for secure Indian payments. You can pay via UPI, credit/debit card, or net banking. You\'re billed monthly or annually depending on your choice.' },
            { q: 'Can I cancel anytime?', a: 'Yes, absolutely. You can cancel your subscription from your Dashboard at any time. Your Pro benefits remain active until the end of the current billing period.' },
            { q: 'Do deals expire?', a: "Yes! Flash and lightning deals are time-limited by the platforms themselves. We timestamp all deals when scraped, but we can't guarantee a price is still live when you click." },
          ].map(({ q, a }) => (
            <div key={q} className="border-b border-[#2A2A35] pb-6 last:border-none last:pb-0">
              <h3 className="font-bold text-white mb-2">{q}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}
