'use client';

import { useEffect, useState } from 'react';
import { Users, Gift, Copy, CheckCheck, ExternalLink } from 'lucide-react';

interface ReferralInfo {
  referral_code: string;
  referral_link: string;
  total_referrals: number;
  pro_months_earned: number;
}

export function ReferralWidget() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/referral')
      .then(r => r.json())
      .then(d => { setInfo(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const copy = async () => {
    if (!info?.referral_link) return;
    await navigator.clipboard.writeText(info.referral_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    if (!info) return;
    const text = `🔥 I use ShadowMerchant to find the best deals from Amazon, Flipkart & more!\n\nSign up free using my link and start saving:\n${info.referral_link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Milestone: 5 referrals = 1 month Pro
  const nextMilestone = 5 - (info?.total_referrals ?? 0) % 5;
  const milestone = info ? Math.floor(info.total_referrals / 5) : 0;

  if (loading) return (
    <div className="rounded-xl p-6 animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)', height: 160 }} />
  );

  if (!info) return null;

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--gold-border)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--gold-dim)' }}>
          <Gift className="w-5 h-5" style={{ color: 'var(--gold)' }} />
        </div>
        <div>
          <h3 className="font-bold text-white">Refer Friends, Earn Pro</h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>5 referrals = 1 month Pro free</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-raised)' }}>
          <p className="text-2xl font-black text-white">{info.total_referrals}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Friends referred</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-raised)' }}>
          <p className="text-2xl font-black" style={{ color: 'var(--gold)' }}>{info.pro_months_earned}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pro months earned</p>
        </div>
      </div>

      {/* Progress to next milestone */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
          <span>Progress to next free month</span>
          <span style={{ color: 'var(--gold)' }}>{5 - nextMilestone}/5</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-overlay)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${((5 - nextMilestone) / 5) * 100}%`, background: 'var(--gold)' }}
          />
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {nextMilestone === 5 ? 'Start referring to earn Pro!' : `${nextMilestone} more referral${nextMilestone !== 1 ? 's' : ''} to unlock 1 free month`}
        </p>
      </div>

      {/* Referral link */}
      <div className="flex items-center gap-2 p-3 rounded-lg mb-3" style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)' }}>
        <code className="flex-1 text-xs truncate" style={{ color: 'var(--gold)' }}>{info.referral_link}</code>
        <button
          onClick={copy}
          className="shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded transition-all"
          style={{ background: copied ? 'rgba(34,197,94,0.1)' : 'var(--gold-dim)', color: copied ? '#22c55e' : 'var(--gold)' }}
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        <button
          onClick={shareViaWhatsApp}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90"
          style={{ background: '#25D366', color: '#fff' }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
          Share on WhatsApp
        </button>
        <button
          onClick={copy}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all"
          style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}
        >
          <Copy className="w-4 h-4" /> Copy Link
        </button>
      </div>
    </div>
  );
}
