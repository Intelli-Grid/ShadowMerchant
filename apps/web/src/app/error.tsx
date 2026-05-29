'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Root-level error boundary for the Next.js App Router.
 *
 * Catches uncaught render errors in any Server or Client Component
 * that doesn't have a more specific error.tsx in its route segment.
 * Without this file, uncaught errors show the raw Next.js white
 * error screen instead of a branded recovery page.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error monitoring service (Sentry, etc.)
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        background: 'var(--bg-base, #0A0A0A)',
        color: 'var(--text-primary, #F2F2F3)',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', lineHeight: 1 }}>⚠</div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          margin: 0,
          color: 'var(--gold, #C9A84C)',
        }}
      >
        Something went wrong
      </h1>
      <p
        style={{
          color: 'var(--text-secondary, #8A8A96)',
          maxWidth: '38ch',
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        An unexpected error occurred. Our team has been notified automatically.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            background: 'var(--gold, #C9A84C)',
            color: '#0A0A0A',
            fontWeight: 700,
            border: 'none',
            borderRadius: '10px',
            padding: '0.65rem 1.5rem',
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            background: 'transparent',
            color: 'var(--gold, #C9A84C)',
            border: '1px solid rgba(201, 168, 76, 0.35)',
            borderRadius: '10px',
            padding: '0.65rem 1.5rem',
            textDecoration: 'none',
            fontSize: '0.95rem',
          }}
        >
          Go home
        </Link>
      </div>
      {error.digest && (
        <p
          style={{
            color: 'var(--text-muted, #6B6B7A)',
            fontSize: '0.72rem',
            margin: 0,
            fontFamily: 'monospace',
          }}
        >
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
