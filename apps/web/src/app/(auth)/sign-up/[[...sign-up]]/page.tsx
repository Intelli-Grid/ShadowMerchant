'use client';

/**
 * Sign-up page — UTM-aware
 * ========================
 * Reads first-touch UTM data from localStorage (written by UtmCapture.tsx
 * on any landing page) and passes it to Clerk's unsafeMetadata.
 *
 * Clerk stores unsafeMetadata on the user object and includes it in the
 * user.created webhook payload (evt.data.unsafe_metadata), where the
 * webhook handler reads it and:
 *   1. Writes signup_source to MongoDB User document
 *   2. Fires a PostHog user_signed_up event with the source property
 *
 * If no UTM is stored (direct visit, private browsing, etc.),
 * unsafeMetadata is empty — the webhook defaults signup_source to 'direct'.
 */

import { SignUp } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { UTM_STORAGE_KEY } from '@/components/UtmCapture';

export default function SignUpPage() {
  const [utmMeta, setUtmMeta] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UTM_STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, string> = JSON.parse(raw);
        // Only forward known UTM keys to Clerk — don't leak arbitrary storage
        const safe: Record<string, string> = {};
        for (const key of ['utm_source', 'utm_medium', 'utm_campaign'] as const) {
          if (parsed[key] && typeof parsed[key] === 'string') {
            safe[key] = parsed[key].slice(0, 100); // cap length for safety
          }
        }
        setUtmMeta(safe);
      }
    } catch {
      // localStorage unavailable — skip, signup proceeds without attribution
    }
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center min-h-[70vh] px-4">
      <SignUp unsafeMetadata={utmMeta} />
    </div>
  );
}
