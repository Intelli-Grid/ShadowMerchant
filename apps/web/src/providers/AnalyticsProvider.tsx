'use client';

import posthog from 'posthog-js';
import { PostHogProvider, usePostHog } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function PosthogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname;
      if (searchParams.toString()) url += `?${searchParams.toString()}`;
      ph.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, ph]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return; // gracefully skip if not configured
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      capture_pageview: false,       // handled manually above
      capture_pageleave: true,
      autocapture: false,            // manual events only — no noise
      persistence: 'localStorage',
    });
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PosthogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
