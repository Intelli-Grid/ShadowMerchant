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
        return;
      }

      const { subscription_id } = await res.json();

      // 2 — Load Razorpay checkout
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
    } catch (err) {
      console.error(err);
      alert('Something went wrong. Please try again.');
    } finally {
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
