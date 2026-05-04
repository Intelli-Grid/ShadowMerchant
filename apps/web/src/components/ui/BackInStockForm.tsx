'use client';

import { useState } from 'react';

interface BackInStockFormProps {
  dealId: string;
  dealTitle: string;
}

export function BackInStockForm({ dealId, dealTitle }: BackInStockFormProps) {
  const [email, setEmail]       = useState('');
  const [status, setStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/notify/back-in-stock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, dealId, dealTitle }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setMessage("You're on the list! We'll email you if this deal returns.");
        setEmail('');
      } else {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div
        className="mt-3 px-3 py-2 rounded-lg text-center text-xs font-semibold"
        style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}
      >
        ✅ {message}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
        🔔 Notify me when back in stock
      </p>
      <div className="flex gap-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          disabled={status === 'loading'}
          className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none transition-all"
          style={{
            background:  'var(--bg-raised)',
            border:      '1px solid var(--sm-border)',
            color:       'var(--text-primary)',
          }}
          onFocus={(e)  => (e.target.style.borderColor = 'var(--gold-border)')}
          onBlur={(e)   => (e.target.style.borderColor = 'var(--sm-border)')}
        />
        <button
          type="submit"
          disabled={status === 'loading' || !email}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
          style={{ background: 'var(--gold)', color: '#0A0A0A' }}
        >
          {status === 'loading' ? '…' : 'Notify'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-[10px] mt-1" style={{ color: '#EF4444' }}>{message}</p>
      )}
    </form>
  );
}
