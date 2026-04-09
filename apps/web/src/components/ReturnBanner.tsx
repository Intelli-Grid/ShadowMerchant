'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

export function ReturnBanner() {
  const [show, setShow] = useState(false);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    try {
      const lastVisit = localStorage.getItem('sm_last_visit');
      const now = new Date().toISOString();
      
      if (lastVisit) {
        // We calculate an estimated drop count based on hours since last visit: ~4 deals found per hour
        const lastDate = new Date(lastVisit).getTime();
        const diffHours = (Date.now() - lastDate) / (1000 * 60 * 60);
        
        if (diffHours > 2 && diffHours < 168) { // Between 2 hours and 7 days
           const estimatedNewDeals = Math.min(Math.floor((diffHours * 4.2) + Math.random() * 5), 350);
           if (estimatedNewDeals > 10) {
             setNewCount(estimatedNewDeals);
             setShow(true);
           }
        }
      }
      
      // Update last visit for next time
      // We set a short delay to not immediately clear the banner if strict mode double-fires
      const timer = setTimeout(() => {
        localStorage.setItem('sm_last_visit', now);
      }, 5000); 
      
      // Clear banner automatically after 10s so it doesn't stay forever
      const hideTimer = setTimeout(() => {
        setShow(false);
      }, 15000);

      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    } catch {}
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 duration-500">
      <div 
        className="flex items-center gap-3 px-4 py-2.5 rounded-full shadow-2xl pr-12 relative"
        style={{ background: 'rgba(13, 27, 42, 0.85)', border: '1px solid var(--gold)', backdropFilter: 'blur(16px)' }}
      >
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gold)', color: '#0A0A0A' }}>
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <p className="text-sm font-semibold truncate tracking-tight max-w-[250px] sm:max-w-none text-white whitespace-nowrap">
          Welcome back! <span style={{ color: 'var(--gold)' }}>{newCount} new deals</span> dropped.
        </p>
        <button 
          onClick={() => setShow(false)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-gray-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
