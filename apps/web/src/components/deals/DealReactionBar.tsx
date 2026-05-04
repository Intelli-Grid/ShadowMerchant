"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

type ReactionType = 'fire' | 'meh' | 'expired';

interface Counts {
  fire: number;
  meh: number;
  expired: number;
}

interface Props {
  dealId: string;
  /** Pass initial counts from SSR to avoid flash */
  initialCounts?: Counts;
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'fire',    emoji: '🔥', label: 'Hot deal' },
  { type: 'meh',     emoji: '😐', label: 'Meh'      },
  { type: 'expired', emoji: '💀', label: 'Expired'   },
];

export function DealReactionBar({ dealId, initialCounts }: Props) {
  const { isSignedIn } = useAuth();
  const [counts, setCounts] = useState<Counts>(
    initialCounts ?? { fire: 0, meh: 0, expired: 0 }
  );
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}/reactions`);
      if (!res.ok) return;
      const data = await res.json();
      setCounts(data.counts ?? { fire: 0, meh: 0, expired: 0 });
      setUserReaction(data.userReaction ?? null);
    } catch {}
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const handleReact = async (reaction: ReactionType) => {
    if (!isSignedIn || pending) return;
    setPending(true);

    // Optimistic update
    const prev = userReaction;
    const prevCounts = { ...counts };

    const next = userReaction === reaction ? null : reaction;
    setUserReaction(next);
    setCounts(c => {
      const updated = { ...c };
      if (prev) updated[prev] = Math.max(0, updated[prev] - 1);
      if (next) updated[next] = updated[next] + 1;
      return updated;
    });

    try {
      const res = await fetch(`/api/deals/${dealId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Rollback
      setUserReaction(prev);
      setCounts(prevCounts);
    } finally {
      setPending(false);
    }
  };

  const total = counts.fire + counts.meh + counts.expired;

  return (
    <div
      className="flex flex-col gap-2"
      role="group"
      aria-label="Community reactions"
    >
      {/* Label row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Community Verdict
        </p>
        {total > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {total} vote{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Reaction buttons */}
      <div className="flex gap-2">
        {REACTIONS.map(({ type, emoji, label }) => {
          const active = userReaction === type;
          const count  = counts[type];

          return (
            <button
              key={type}
              onClick={() => handleReact(type)}
              disabled={pending}
              title={!isSignedIn ? 'Sign in to react' : label}
              aria-pressed={active}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={{
                background: active
                  ? type === 'fire'    ? 'rgba(251,146,60,0.15)'
                  : type === 'expired' ? 'rgba(148,163,184,0.15)'
                  :                     'rgba(148,163,184,0.1)'
                  : 'var(--bg-raised)',
                border: `1px solid ${
                  active
                    ? type === 'fire'    ? 'rgba(251,146,60,0.5)'
                    : type === 'expired' ? 'rgba(148,163,184,0.4)'
                    :                     'rgba(148,163,184,0.3)'
                    : 'var(--sm-border)'
                }`,
                color: active
                  ? type === 'fire'    ? '#fb923c'
                  : type === 'expired' ? '#94a3b8'
                  :                     '#94a3b8'
                  : 'var(--text-muted)',
                transform: active ? 'scale(1.05)' : 'scale(1)',
                opacity: pending ? 0.7 : 1,
                cursor: !isSignedIn ? 'default' : pending ? 'wait' : 'pointer',
              }}
            >
              <span className="text-base leading-none">{emoji}</span>
              {count > 0 && (
                <span className="tabular-nums">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress bar — shows reaction distribution */}
      {total > 0 && (
        <div
          className="flex rounded-full overflow-hidden h-1.5 mt-0.5"
          style={{ background: 'var(--bg-raised)' }}
          title={`🔥 ${counts.fire} · 😐 ${counts.meh} · 💀 ${counts.expired}`}
        >
          {counts.fire > 0 && (
            <div
              style={{ width: `${(counts.fire / total) * 100}%`, background: '#fb923c', transition: 'width 0.4s ease' }}
            />
          )}
          {counts.meh > 0 && (
            <div
              style={{ width: `${(counts.meh / total) * 100}%`, background: '#64748b', transition: 'width 0.4s ease' }}
            />
          )}
          {counts.expired > 0 && (
            <div
              style={{ width: `${(counts.expired / total) * 100}%`, background: '#374151', transition: 'width 0.4s ease' }}
            />
          )}
        </div>
      )}

      {!isSignedIn && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <a href="/sign-in" style={{ color: 'var(--gold)' }}>Sign in</a> to add your verdict.
        </p>
      )}
    </div>
  );
}
