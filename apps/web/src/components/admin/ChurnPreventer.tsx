'use client';

import { useState } from 'react';
import { ActionButton } from '@/components/admin';

export function ChurnPreventer({
  clerkUserId,
  userName,
}: {
  clerkUserId: string;
  userName: string;
}) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/churn-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkUserId }),
      });
      const data = await res.json();
      if (data.message) {
        setMessage(data.message);
        setShowMessage(true);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <ActionButton onClick={generate} loading={loading} variant="ghost" className="text-[10px] px-2 py-1">
        ✉ Draft Msg
      </ActionButton>

      {showMessage && message && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowMessage(false)}
        >
          <div
            className="rounded-2xl p-6 max-w-lg w-full"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold mb-3 text-sm" style={{ color: 'white' }}>
              Retention Message for {userName}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              {message}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(message); }}
                className="px-3 py-2 rounded-lg text-xs font-bold"
                style={{ background: 'var(--gold)', color: '#000' }}
              >
                📋 Copy
              </button>
              <button
                onClick={() => setShowMessage(false)}
                className="px-3 py-2 rounded-lg text-xs font-bold"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--sm-border)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
