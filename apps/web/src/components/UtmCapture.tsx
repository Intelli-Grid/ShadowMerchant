'use client';

/**
 * UtmCapture — First-touch UTM attribution
 * =========================================
 * Runs on every page load. Reads utm_source / utm_medium / utm_campaign
 * from the current URL and writes them to localStorage (key: sm_utm).
 *
 * First-touch only: never overwrites an existing stored UTM so we attribute
 * sign-ups to the channel that first brought the user, not the last one.
 *
 * At sign-up, the SignUp page reads sm_utm and passes it to Clerk's
 * unsafeMetadata so the user.created webhook can persist it to MongoDB
 * and fire a PostHog event.
 *
 * Wrapped in Suspense at call-site (layout.tsx) — useSearchParams()
 * requires it in the Next.js App Router.
 */

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export const UTM_STORAGE_KEY = 'sm_utm';

function UtmCaptureInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const utmData: Record<string, string> = {};
    let hasUtm = false;

    for (const key of UTM_KEYS) {
      const val = searchParams?.get(key);
      if (val) {
        utmData[key] = val;
        hasUtm = true;
      }
    }

    if (!hasUtm) return;

    try {
      // First-touch: never overwrite an already-stored UTM
      const existing = localStorage.getItem(UTM_STORAGE_KEY);
      if (!existing) {
        localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmData));
      }
    } catch {
      // localStorage unavailable (SSR path, private browsing) — safe to skip
    }
  }, [searchParams]);

  return null;
}

export function UtmCapture() {
  return (
    <Suspense fallback={null}>
      <UtmCaptureInner />
    </Suspense>
  );
}
