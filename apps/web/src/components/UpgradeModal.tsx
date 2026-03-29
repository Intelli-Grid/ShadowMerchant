'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function UpgradeModal({ 
  isOpen, 
  onClose,
  title = "Unlock ShadowMerchant Pro",
  description = "You've hit a free tier limit. Upgrade to Pro to get full access to the platform."
}: UpgradeModalProps) {
  const features = [
    "Unlimited Wishlist Saves",
    "Real-time Deal Alerts",
    "Historical Price Analytics",
    "Priority AI Scoring"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-0" style={{ background: 'var(--bg-surface)', border: '1px solid var(--gold-border)' }}>
        <DialogHeader className="text-center sm:text-center pt-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full mb-4" style={{ background: 'var(--gold-dim)' }}>
            <Sparkles className="h-7 w-7" style={{ color: 'var(--gold)' }} />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </DialogTitle>
          <DialogDescription className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 space-y-3 px-6">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--gold)' }} />
              <span className="text-sm font-medium text-white">{f}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 px-6 pb-6">
          <Link 
            href="/pro"
            onClick={onClose}
            className="w-full flex items-center justify-center py-3 rounded-xl font-bold transition-all text-black hover:scale-105 active:scale-95"
            style={{ background: 'var(--gold)' }}
          >
            Upgrade to Pro
          </Link>
          <button 
            onClick={onClose}
            className="w-full py-2 text-sm font-medium hover:text-white transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Maybe Later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
