'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export function SplashScreen() {
  // BUG-17: Lazy initializer reads localStorage synchronously on first render —
  // avoids the 1-frame flash caused by useState(false) + async useEffect pattern.
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false; // SSR guard
    return !localStorage.getItem('sm_splash_seen_v2');
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // Start fade-out at 1.8s, fully hide at 2.2s
    const fadeTimer = setTimeout(() => setFading(true), 1800);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      localStorage.setItem('sm_splash_seen_v2', '1');
    }, 2200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);


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

      {/* WhatsApp Channel CTA — fades in as the splash begins dismissing */}
      <a
        href="https://whatsapp.com/channel/0029Vb7dimp1XquQpiaSWQ1N"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold"
        style={{
          background: 'rgba(37,211,102,0.10)',
          border: '1px solid rgba(37,211,102,0.35)',
          color: '#25D366',
          opacity: fading ? 1 : 0,
          transform: fading ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
          pointerEvents: fading ? 'auto' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="#25D366" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Join our WhatsApp Channel →
      </a>

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
