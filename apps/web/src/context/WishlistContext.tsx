'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { UpgradeModal } from '@/components/UpgradeModal';

interface WishlistContextType {
  wishlistedIds: Set<string>;
  toggle: (dealId: string) => Promise<void>;
  isWishlisted: (dealId: string) => boolean;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextType>({
  wishlistedIds: new Set(),
  toggle: async () => {},
  isWishlisted: () => false,
  loading: false,
});

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Fetch wishlist when user signs in
  useEffect(() => {
    let isMounted = true;
    
    const syncWishlist = async () => {
      if (!isSignedIn) {
        if (isMounted) setWishlistedIds(new Set());
        return;
      }

      if (isMounted) setLoading(true);
      try {
        const r = await fetch('/api/wishlist');
        const data = r.ok ? await r.json() : { wishlist: [] };
        if (isMounted) {
          setWishlistedIds(new Set((data.wishlist || []).map(String)));
        }
      } catch {
        // fail silently
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    syncWishlist();

    return () => {
      isMounted = false;
    };
  }, [isSignedIn]);

  const toggle = useCallback(async (dealId: string) => {
    if (!isSignedIn) return;
    const isCurrentlyWishlisted = wishlistedIds.has(dealId);
    const action = isCurrentlyWishlisted ? 'remove' : 'add';

    // Optimistic update
    setWishlistedIds(prev => {
      const next = new Set(prev);
      isCurrentlyWishlisted ? next.delete(dealId) : next.add(dealId);
      return next;
    });

    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, action }),
      });

      if (!res.ok) {
        try {
          const errData = await res.json();
          if (errData.error === 'WISHLIST_LIMIT') {
            setShowUpgradeModal(true);
          }
        } catch {}
        throw new Error('Wishlist limit or server error');
      }
    } catch {
      // Revert on failure
      setWishlistedIds(prev => {
        const next = new Set(prev);
        isCurrentlyWishlisted ? next.add(dealId) : next.delete(dealId);
        return next;
      });
    }
  }, [isSignedIn, wishlistedIds]);

  const isWishlisted = useCallback((dealId: string) => wishlistedIds.has(dealId), [wishlistedIds]);

  return (
    <WishlistContext.Provider value={{ wishlistedIds, toggle, isWishlisted, loading }}>
      {children}
      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        title="Wishlist Limit Reached"
        description="Free users are limited to 5 wishlist saves to prevent abuse. Upgrade to Pro for unlimited saves and Deal Alerts."
      />
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
