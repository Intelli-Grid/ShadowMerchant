'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CheckCircle2, Loader2 } from 'lucide-react';

interface TargetPriceAlertButtonProps {
  dealId: string;
  currentPrice: number;
  productTitle: string;
  platform: string;
  buttonLabel?: string; // UPGRADE-J: optional custom label for contextual CTAs
}

type AlertState = 'idle' | 'loading' | 'set' | 'setting' | 'removing' | 'error';

export function TargetPriceAlertButton({
  dealId,
  currentPrice,
  productTitle,
  platform,
  buttonLabel,
}: TargetPriceAlertButtonProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<AlertState>('loading');
  const [targetPrice, setTargetPrice] = useState<string>(
    String(Math.floor(currentPrice * 0.9)) // default: 10% below current
  );
  const [existingAlertId, setExistingAlertId] = useState<string | null>(null);
  const [setAtPrice, setSetAtPrice] = useState<number | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Check if user already has an alert for this deal
  useEffect(() => {
    if (!isSignedIn) {
      setState('idle');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/alerts/target-price?deal_id=${dealId}`);
        const data = await res.json();
        if (data.hasAlert && data.alert) {
          setExistingAlertId(data.alert._id);
          setSetAtPrice(data.alert.target_price);
          setState('set');
        } else {
          setState('idle');
        }
      } catch {
        setState('idle');
      }
    })();
  }, [isSignedIn, dealId]);

  const handleSetAlert = async () => {
    const parsed = parseFloat(targetPrice);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg('Enter a valid price');
      return;
    }
    if (parsed >= currentPrice) {
      setErrorMsg('Target must be below current price');
      return;
    }
    setErrorMsg('');
    setState('setting');
    try {
      const res = await fetch('/api/alerts/target-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, target_price: parsed }),
      });
      const data = await res.json();
      if (res.ok) {
        setExistingAlertId(data.alert._id);
        setSetAtPrice(parsed);
        setState('set');
        setShowInput(false);
      } else {
        setErrorMsg(data.error || 'Failed to set alert');
        setState('idle');
      }
    } catch {
      setErrorMsg('Network error — please try again');
      setState('idle');
    }
  };

  const handleRemoveAlert = async () => {
    if (!existingAlertId) return;
    setState('removing');
    try {
      await fetch('/api/alerts/target-price', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: existingAlertId }),
      });
      setExistingAlertId(null);
      setSetAtPrice(null);
      setState('idle');
      setShowInput(false);
    } catch {
      setState('set');
    }
  };

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p);

  // ── Not signed in ─────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <button
        onClick={() => router.push('/sign-in')}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
        style={{
          background: 'rgba(201,168,76,0.08)',
          border: '1px solid var(--gold-border)',
          color: 'var(--gold)',
        }}
        aria-label="Sign in to set a price alert"
      >
        <Bell className="w-4 h-4" />
        Sign in to get price drop alerts
      </button>
    );
  }

  // ── Loading check ─────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)', color: 'var(--text-muted)' }}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking alerts…
      </div>
    );
  }

  // ── Alert already set ─────────────────────────────────────────
  if (state === 'set' || state === 'removing') {
    return (
      <div
        className="w-full rounded-xl p-4 flex flex-col gap-3"
        style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-green-400">Price alert active</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              We&apos;ll notify you when this drops to{' '}
              <strong className="text-white">{setAtPrice ? formatPrice(setAtPrice) : '—'}</strong>
            </p>
          </div>
        </div>
        <button
          onClick={handleRemoveAlert}
          disabled={state === 'removing'}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
          style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)' }}
          aria-label="Remove price alert"
        >
          {state === 'removing' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BellOff className="w-3.5 h-3.5" />
          )}
          {state === 'removing' ? 'Removing…' : 'Remove alert'}
        </button>
      </div>
    );
  }

  // ── Idle / Input ──────────────────────────────────────────────
  if (showInput || state === 'setting') {
    return (
      <div
        className="w-full rounded-xl p-4 flex flex-col gap-3"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
      >
        <p className="text-xs font-bold text-white">Set your target price</p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Current price: <strong className="text-white">{formatPrice(currentPrice)}</strong>
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>₹</span>
          <input
            type="number"
            min={1}
            max={currentPrice - 1}
            value={targetPrice}
            onChange={(e) => { setTargetPrice(e.target.value); setErrorMsg(''); }}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:ring-2"
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--sm-border)',
              ['--tw-ring-color' as string]: 'var(--gold)',
            }}
            placeholder="Enter target price"
            aria-label="Target price in rupees"
            id={`target-price-input-${dealId}`}
          />
        </div>
        {errorMsg && (
          <p className="text-[11px] font-semibold text-red-400">{errorMsg}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSetAlert}
            disabled={state === 'setting'}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'var(--gold)', color: '#0A0A0A' }}
            aria-label="Confirm target price alert"
          >
            {state === 'setting' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Setting…</>
            ) : (
              <><Bell className="w-4 h-4" /> Alert me</>
            )}
          </button>
          <button
            onClick={() => { setShowInput(false); setErrorMsg(''); }}
            className="px-3 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--sm-border)' }}
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Default: show "Alert me" button ──────────────────────────
  return (
    <button
      onClick={() => setShowInput(true)}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
      style={{
        background: 'rgba(201,168,76,0.08)',
        border: '1px solid var(--gold-border)',
        color: 'var(--gold)',
      }}
      aria-label="Set a price drop alert for this product"
    >
      <Bell className="w-4 h-4" />
      {buttonLabel ?? 'Alert me when price drops'}
    </button>
  );
}
