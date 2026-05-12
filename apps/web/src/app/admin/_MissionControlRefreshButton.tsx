'use client';

// G3: Client-side Mission Control refresh button.
// Uses router.refresh() to re-run all server components on the page
// and fetch fresh data from MongoDB without a full page reload.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function MissionControlRefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = () => {
    setSpinning(true);
    router.refresh();
    // Reset spinner after 2.5 seconds (typical server component re-render time)
    setTimeout(() => setSpinning(false), 2500);
  };

  return (
    <button
      onClick={handleRefresh}
      title="Refresh Mission Control data"
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80 active:scale-95"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--sm-border)',
        color: 'var(--text-secondary)',
      }}
    >
      <RefreshCw
        className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
        style={{ color: 'var(--gold)' }}
      />
      Refresh
    </button>
  );
}
