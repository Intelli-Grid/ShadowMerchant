"use client";

import Link from 'next/link';
import { Zap } from 'lucide-react';

export function UpgradeCTA() {
  return (
    <div className="w-full bg-gradient-to-r from-[#3B1F6E] via-[#7C3AED]/30 to-[#3B1F6E] border border-[#7C3AED]/40 rounded-xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#7C3AED] flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm">🔒 Pro Exclusive Deals Locked</p>
          <p className="text-gray-400 text-xs">50–80% off deals are only visible to Pro members.</p>
        </div>
      </div>
      <Link
        href="/pro"
        className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-extrabold px-6 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap shadow-lg shadow-[#7C3AED]/30 flex-shrink-0"
      >
        Unlock for ₹299/mo →
      </Link>
    </div>
  );
}
