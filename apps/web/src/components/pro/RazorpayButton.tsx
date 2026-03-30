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

      // 2 — Wait for Razorpay checkout.js to load (it's loaded async)
      await new Promise<void>((resolve, reject) => {
        if (window.Razorpay) return resolve();
        const script = document.querySelector('script[src*="checkout.razorpay.com"]');
        if (!script) return reject(new Error('Razorpay script not found'));
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => reject(new Error('Razorpay failed to load')));
        // Timeout after 8 seconds
        setTimeout(() => reject(new Error('Razorpay load timeout')), 8000);
      });

      // 3 — Open Razorpay checkout modal
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id,
        name: 'ShadowMerchant',
        description: `Pro ${plan === 'annual' ? 'Annual' : 'Monthly'} Plan`,
        image: '/logo.png',
        theme: { color: '#C9A84C' },
        handler: () => {
          router.push('/dashboard?upgraded=true');
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
    <>
      {/* Razorpay checkout.js */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

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
    </>
  );
}
