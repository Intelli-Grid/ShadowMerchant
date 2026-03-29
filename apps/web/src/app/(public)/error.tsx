'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('ShadowMerchant UI Error:', error);
  }, [error]);

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center text-center">
      <div className="w-20 h-20 mb-6 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center text-4xl border border-red-900/50">
        ⚠️
      </div>
      <h2 className="text-3xl font-black text-white mb-4">Something went wrong!</h2>
      <p className="text-gray-400 max-w-lg mb-8">
        We ran into an unexpected issue while loading this page. Our team has been notified.
      </p>
      
      <div className="flex gap-4 items-center">
        <button
          onClick={() => reset()}
          className="btn-gold px-6 py-3 rounded-xl font-bold"
        >
          Try again
        </button>
        <Link href="/" className="btn-gold-outline px-6 py-3 rounded-xl font-bold">
          Go Home
        </Link>
      </div>
    </main>
  );
}
