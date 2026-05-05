'use client';

import { useState } from 'react';

interface EmailCaptureInlineProps {
  source: string;
  placeholder?: string;
  ctaLabel?: string;
}

/**
 * TASK-5 / Sprint 4B — Inline email capture for empty category states.
 * Submits to /api/waitlist and shows a success confirmation in-place.
 * Used by CategorySwimlane when no deals are available in a category.
 */
export function EmailCaptureInline({
  source,
  placeholder = 'Your email',
  ctaLabel = 'Notify Me →',
}: EmailCaptureInlineProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        setError('Something went wrong. Try again.');
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <p
        className="text-sm font-semibold py-2"
        style={{ color: '#22c55e' }}
      >
        ✓ Got it! We'll notify you when deals land in this category.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 justify-center flex-wrap max-w-md mx-auto"
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        disabled={submitting}
        className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--sm-border)',
          color: 'var(--text-primary)',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--sm-border)')}
      />
      <button
        type="submit"
        disabled={submitting}
        className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
        style={{ background: 'var(--gold)', color: '#0A0A0A' }}
      >
        {submitting ? '...' : ctaLabel}
      </button>
      {error && (
        <p className="w-full text-center text-xs" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}
    </form>
  );
}
