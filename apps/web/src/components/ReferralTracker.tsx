'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Invisible component — reads ?ref= from URL and stores it in localStorage.
 * When the user signs up, the signup page will read this and apply the referral code.
 */
export function ReferralTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref && ref.startsWith('SM-')) {
      localStorage.setItem('sm_ref_code', ref.toUpperCase());
    }
  }, [searchParams]);

  return null;
}
