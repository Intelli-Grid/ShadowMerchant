"use client";

import Link from 'next/link';
import { Zap } from 'lucide-react';

export function UpgradeCTA() {
  return (
    <div
      className="w-full rounded-xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4"
      style={{
        background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-overlay))',
        border: '1px solid var(--gold-border)',
        boxShadow: '0 0 24px rgba(201,168,76,0.06)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--gold)', boxShadow: '0 0 12px rgba(201,168,76,0.3)' }}
        >
          <Zap className="w-4 h-4" style={{ color: '#0A0A0A' }} />
        </div>
        <div>
          <p className="text-white font-bold text-sm">✦ Pro Exclusive Deals Locked</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            50–80% off deals are only visible to Pro members.
          </p>
        </div>
      </div>
      <Link
        href="/pro"
        className="font-extrabold px-6 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap flex-shrink-0 hover:scale-105 active:scale-95"
        style={{ background: 'var(--gold)', color: '#0A0A0A' }}
      >
        Unlock for ₹299/mo →
      </Link>
    </div>
  );
}
