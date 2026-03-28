'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem('sm_splash_seen');
    if (!seen) {
      setVisible(true);
      // Start fade-out at 1.8s, fully hide at 2.2s
      const fadeTimer = setTimeout(() => setFading(true), 1800);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        sessionStorage.setItem('sm_splash_seen', '1');
      }, 2200);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: '#0A0A0A',
        transition: 'opacity 0.4s ease',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      {/* Logo with rupee glow pulse */}
      <div
        className="relative w-40 h-40"
        style={{ animation: 'rupee-glow-pulse 1.5s ease-in-out infinite' }}
      >
        <Image
          src="/logo.png"
          alt="ShadowMerchant"
          fill
          className="object-contain"
          priority
        />
      </div>

      {/* Wordmark */}
      <div
        className="mt-6 text-3xl font-extrabold tracking-tight"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <span className="text-white">Shadow</span>
        <span style={{ color: 'var(--gold)' }}>Merchant</span>
      </div>

      {/* Tagline */}
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        India&apos;s best deals, all in one place
      </p>

      {/* Gold shimmer progress bar at bottom */}
      <div
        className="absolute bottom-0 left-0 h-0.5 w-full"
        style={{
          background: 'linear-gradient(to right, transparent, var(--gold), transparent)',
          animation: 'shimmer 2s linear infinite',
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  );
}
