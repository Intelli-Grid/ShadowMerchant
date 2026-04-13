'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';

/**
 * Runs once when logged in — reads pending referral code from localStorage
 * and writes it to Clerk unsafeMetadata so the webhook can process it.
 * Also calls our /api/referral POST endpoint as a secondary path.
 */
export function ReferralApplier() {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    if (!isSignedIn || !user) return;

    const refCode = localStorage.getItem('sm_ref_code');
    if (!refCode) return;

    // Fire-and-forget: apply via API
    fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referral_code: refCode }),
    })
      .then(r => r.json())
      .then(() => {
        localStorage.removeItem('sm_ref_code'); // Clear after successful apply
      })
      .catch(() => {}); // Never crash the page for analytics
  }, [isSignedIn, user]);

  return null;
}
