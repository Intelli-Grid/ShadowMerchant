'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CancelSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleCancel = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel your Pro subscription?\n\nYour benefits will remain active until the end of your current billing period.'
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch('/api/payments/cancel-subscription', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to cancel. Please contact support.');
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <p className="text-sm font-medium" style={{ color: 'var(--score-high)' }}>
        ✓ Cancellation scheduled — Pro access continues until end of billing period.
      </p>
    );
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50"
      style={{ color: 'var(--text-muted)' }}
    >
      {loading ? 'Cancelling…' : 'Cancel subscription'}
    </button>
  );
}
