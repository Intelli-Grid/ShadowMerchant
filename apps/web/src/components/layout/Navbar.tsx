'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignInButton, UserButton, useAuth, ClerkLoading, ClerkLoaded } from '@clerk/nextjs';
import { MobileMenu } from './MobileMenu';

const NAV_LINKS = [
  { label: 'Top Deals', href: '/deals' },
  { label: 'Categories', href: '/deals/feed' },
  { label: 'Missed Deals', href: '/missed-deals' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const q = (e.target as HTMLInputElement).value.trim();
      if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <nav
      className={cn(
        'sticky top-0 z-50 w-full h-16',
        'flex items-center justify-between',
        'transition-all duration-300'
      )}
      style={{
        padding: '0 clamp(16px, 4vw, 32px)',
        background: scrolled
          ? 'rgba(10, 10, 10, 0.96)'
          : 'rgba(10, 10, 10, 0.75)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: scrolled
          ? '1px solid rgba(201, 168, 76, 0.15)'
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: scrolled
          ? '0 4px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(201,168,76,0.08)'
          : 'none',
      }}
    >
      {/* ── Logo ── */}
      <Link href="/" className="flex-shrink-0 flex items-center gap-2.5 group logo-breathe">
        <div className="relative w-9 h-9 flex-shrink-0">
          <Image
            src="/logo.png"
            alt="ShadowMerchant"
            fill
            className="object-contain transition-all duration-300 group-hover:scale-105"
            priority
          />
        </div>
        <span
          className="font-extrabold text-xl tracking-tight hidden sm:block"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span style={{ color: 'var(--text-primary)' }}>Shadow</span>
          <span style={{ color: 'var(--gold)' }}>Merchant</span>
        </span>
      </Link>

      {/* ── Desktop nav links ── */}
      <div className="hidden md:flex items-center gap-7">
        {NAV_LINKS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'text-sm font-semibold transition-all duration-200 relative',
              'after:absolute after:-bottom-0.5 after:left-0 after:h-px after:rounded-full',
              'after:transition-all after:duration-200',
              pathname === href || pathname.startsWith(href + '/')
                ? 'after:w-full after:bg-[var(--gold)]'
                : 'after:w-0 hover:after:w-full hover:after:bg-[var(--sm-border-hover)]'
            )}
            style={{
              color: (pathname === href || pathname.startsWith(href + '/'))
                ? 'var(--gold)'
                : 'var(--text-secondary)',
            }}
          >
            {label}
          </Link>
        ))}

        {/* Pro link with glow */}
        <Link
          href="/pro"
          className="flex items-center gap-1.5 text-sm font-semibold transition-all duration-200 hover:opacity-90"
          style={{ color: 'var(--gold)' }}
        >
          <Zap className="h-3.5 w-3.5" />
          ✦ Pro Features
        </Link>
      </div>

      {/* ── Right side ── */}
      <div className="flex items-center gap-3">
        {/* Search bar — desktop */}
        <div
          className="hidden lg:flex items-center gap-2 rounded-full px-3 py-1.5 transition-all duration-200"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--sm-border)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--sm-border)')}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search deals... (Enter ↵)"
            onKeyDown={handleSearch}
            className="bg-transparent border-none text-sm focus:outline-none w-44"
            style={{ color: 'var(--text-primary)', caretColor: 'var(--gold)' }}
          />
          <span className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-gray-500 hidden xl:block pointer-events-none">
            ⌘K
          </span>
        </div>

        {/* Auth — Swaps skeleton with signed-in/signed-out states using Clerk components for perfect hydration */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ClerkLoading>
            <div className="hidden sm:block h-8 w-14 rounded animate-pulse" style={{ background: 'var(--bg-raised)' }} />
            <div className="h-8 w-20 rounded-lg animate-pulse" style={{ background: 'var(--bg-raised)' }} />
          </ClerkLoading>

          <ClerkLoaded>
            {isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="h-8 w-8 hidden sm:flex items-center justify-center rounded-lg transition-colors hover:opacity-80"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)' }}
                  aria-label="Dashboard"
                >
                  <Bell className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                </Link>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: 'w-8 h-8 ring-2 ring-transparent hover:ring-[var(--gold)] transition-all duration-200',
                    },
                  }}
                />
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button
                    className="text-sm font-semibold transition-opacity hover:opacity-80"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Log in
                  </button>
                </SignInButton>
                <SignInButton mode="modal">
                  <button
                    className="flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap"
                    style={{ background: 'var(--gold)', color: '#0A0A0A' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(201,168,76,0.35)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    ⚡ Go Pro · ₹99/mo
                  </button>
                </SignInButton>
              </>
            )}
          </ClerkLoaded>
        </div>

        {/* Mobile menu */}
        <MobileMenu />
      </div>
    </nav>
  );
}
