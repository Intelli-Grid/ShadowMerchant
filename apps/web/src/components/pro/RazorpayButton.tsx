"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayButtonProps {
  plan?: 'monthly' | 'annual';
  label?: string;
  className?: string;
}

export function RazorpayButton({ plan = 'monthly', label, className }: RazorpayButtonProps) {
  const defaultLabel = plan === 'annual' ? 'Get Annual Plan — ₹799/yr' : 'Upgrade to Pro — ₹99/mo';
  const displayLabel = label ?? defaultLabel;
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // 1 — Create subscription on server
      const res = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to start subscription.');
        setLoading(false);
        return;
      }

      const { subscription_id } = await res.json();

      // 2 — Wait for Razorpay (loaded globally in layout.tsx via next/script)
      // Poll instead of relying on load event — handles already-loaded case correctly.
      await new Promise<void>((resolve, reject) => {
        if (window.Razorpay) return resolve();
        let attempts = 0;
        const poll = setInterval(() => {
          if (window.Razorpay) {
            clearInterval(poll);
            resolve();
          } else if (++attempts > 50) {
            // 50 × 200ms = 10 second timeout
            clearInterval(poll);
            reject(new Error('Razorpay failed to load after 10 seconds'));
          }
        }, 200);
      });

        // 3 — Open Razorpay checkout modal
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id,
        name: 'ShadowMerchant',
        description: `Pro ${plan === 'annual' ? 'Annual' : 'Monthly'} Plan`,
        image: '/logo.png',
        theme: { color: '#C9A84C' },
        handler: async () => {
          // HIGH-04 fix: poll for Pro status before redirecting.
          // Razorpay's handler fires when the *checkout UI* completes, but the
          // webhook (subscription.activated) arrives ~1-3 seconds later and is
          // what actually upgrades the DB. Redirect immediately = show Pro UI
          // before it's real. Poll /api/user/me up to 8× (4 s) instead.
          let confirmed = false;
          for (let i = 0; i < 8; i++) {
            await new Promise((r) => setTimeout(r, 500));
            try {
              const check = await fetch('/api/user/me');
              if (check.ok) {
                const data = await check.json();
                if (data?.subscription_tier === 'pro') {
                  confirmed = true;
                  break;
                }
              }
            } catch { /* network hiccup — keep polling */ }
          }
          // confirmed=true  → webhook already fired, user is Pro
          // confirmed=false → webhook is delayed, show pending message
          router.push(confirmed ? '/dashboard?upgraded=true' : '/dashboard?pending=true');
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.open();
    } catch (err: any) {
      console.error('[RazorpayButton]', err);
      alert(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleUpgrade}
      disabled={loading}
      className={`font-extrabold h-14 text-lg transition-all hover:scale-[1.02] active:scale-95 gap-2 ${className}`}
      style={{ background: 'var(--gold)', color: '#0A0A0A', boxShadow: '0 8px 24px rgba(201,168,76,0.25)' }}
      id="razorpay-upgrade-btn"
    >
      {loading ? (
        <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
      ) : (
        <><Zap className="w-5 h-5" /> {displayLabel}</>
      )}
    </Button>
  );
}
