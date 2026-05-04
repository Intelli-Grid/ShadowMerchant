'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Link2, IndianRupee, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function SubmitDealForm() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');

  if (!isSignedIn) {
    return (
      <div
        className="w-full rounded-2xl p-8 text-center border"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
      >
        <p className="text-lg font-bold text-white mb-2">Sign in to submit a deal</p>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          You need a free account to contribute deals to the community.
        </p>
        <button
          onClick={() => router.push('/sign-in')}
          className="px-6 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'var(--gold)', color: '#0A0A0A' }}
        >
          Sign in free →
        </button>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div
        className="w-full rounded-2xl p-8 text-center border flex flex-col items-center gap-4"
        style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)' }}
      >
        <CheckCircle2 className="w-12 h-12 text-green-400" />
        <div>
          <p className="text-lg font-black text-white mb-1">Deal Submitted!</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {message || 'We review all submissions within 24 hours.'}
          </p>
        </div>
        <button
          onClick={() => { setState('idle'); setUrl(''); setPrice(''); setNotes(''); }}
          className="mt-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
          style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--sm-border)' }}
        >
          Submit another deal
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setState('submitting');
    setMessage('');

    try {
      const res = await fetch('/api/deals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          reported_price: price ? parseFloat(price) : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        setState('success');
      } else {
        setMessage(data.error || 'Submission failed. Please try again.');
        setState('error');
      }
    } catch {
      setMessage('Network error — please check your connection and try again.');
      setState('error');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-2xl p-6 sm:p-8 border flex flex-col gap-5"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
    >
      {/* URL field */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Product URL *
        </label>
        <div className="flex items-center gap-2 rounded-xl px-3 py-3 transition-all focus-within:ring-2"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--sm-border)',
            ['--tw-ring-color' as string]: 'var(--gold)',
          }}
        >
          <Link2 className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setState('idle'); setMessage(''); }}
            placeholder="https://www.amazon.in/dp/..."
            required
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-sm"
            style={{ color: 'var(--text-primary)' }}
            id="submit-deal-url"
          />
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Supported: Amazon, Flipkart, Myntra, Meesho, Nykaa
        </p>
      </div>

      {/* Price field */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Discounted Price (optional)
        </label>
        <div className="flex items-center gap-2 rounded-xl px-3 py-3 transition-all focus-within:ring-2"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--sm-border)',
            ['--tw-ring-color' as string]: 'var(--gold)',
          }}
        >
          <IndianRupee className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Leave blank — we'll try to fetch it"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
            id="submit-deal-price"
          />
        </div>
      </div>

      {/* Notes field */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why is this a great deal? (max 500 characters)"
          maxLength={500}
          rows={3}
          className="rounded-xl px-3 py-3 text-sm resize-none outline-none transition-all focus:ring-2"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--sm-border)',
            color: 'var(--text-primary)',
            ['--tw-ring-color' as string]: 'var(--gold)',
          }}
          id="submit-deal-notes"
        />
        <p className="text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>
          {notes.length}/500
        </p>
      </div>

      {/* Error message */}
      {state === 'error' && message && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          <p className="text-xs text-red-400">{message}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={state === 'submitting' || !url.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'var(--gold)', color: '#0A0A0A' }}
        id="submit-deal-button"
      >
        {state === 'submitting' ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
        ) : (
          '🔥 Submit This Deal'
        )}
      </button>
    </form>
  );
}
