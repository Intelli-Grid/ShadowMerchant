'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import { MobileMenu } from './MobileMenu';

const NAV_LINKS = [
  { label: 'Top Deals', href: '/deals' },
  { label: 'Electronics', href: '/category/electronics' },
  { label: 'Fashion', href: '/category/fashion' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  // Add .scrolled class past 20px scroll
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
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
          ? 'rgba(10, 10, 11, 0.94)'
          : 'rgba(10, 10, 11, 0.72)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: `1px solid ${scrolled ? 'var(--sm-border-hover)' : 'var(--sm-border)'}`,
        boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {/* ── Logo ── */}
      <Link href="/" className="flex-shrink-0 flex items-center gap-2.5 group">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shadow-lg transition-transform group-hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, var(--sm-accent), #FF9500)',
            color: '#000',
            boxShadow: '0 0 16px rgba(255,107,44,0.3)',
          }}
        >
          SM
        </div>
        <span
          className="font-extrabold text-xl tracking-tight hidden sm:block"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Shadow<span style={{ color: 'var(--sm-accent)' }}>Merchant</span>
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
                ? 'after:w-full after:bg-[var(--sm-accent)]'
                : 'after:w-0 hover:after:w-full hover:after:bg-[var(--sm-border-hover)]'
            )}
            style={{
              color: (pathname === href || pathname.startsWith(href + '/'))
                ? 'var(--sm-accent)'
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
          style={{ color: 'var(--sm-accent)' }}
        >
          <Zap className="h-3.5 w-3.5" />
          ✦ Pro Exclusives
        </Link>
      </div>

      {/* ── Right side ── */}
      <div className="flex items-center gap-3">
        {/* Search bar — desktop */}
        <div
          className="hidden lg:flex items-center gap-2 rounded-full px-3 py-1.5 transition-all duration-200 focus-within:ring-1"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--sm-border)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sm-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--sm-border)')}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search deals, brands..."
            onKeyDown={handleSearch}
            className="bg-transparent border-none text-sm focus:outline-none w-44"
            style={{ color: 'var(--text-primary)', caretColor: 'var(--sm-accent)' }}
          />
        </div>

        {/* Auth */}
        {isLoaded && isSignedIn ? (
          <>
            <Link
              href="/dashboard"
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)' }}
              aria-label="Dashboard"
            >
              <Bell className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
            </Link>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8 ring-2 ring-transparent hover:ring-[var(--sm-accent)] transition-all duration-200',
                },
              }}
            />
          </>
        ) : isLoaded ? (
          <>
            <SignInButton mode="modal">
              <button
                className="hidden md:block text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: 'var(--text-secondary)' }}
              >
                Log in
              </button>
            </SignInButton>
            <SignInButton mode="modal">
              <button
                className="hidden sm:flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--sm-accent)' }}
              >
                Get Pro →
              </button>
            </SignInButton>
          </>
        ) : null}

        {/* Mobile menu */}
        <MobileMenu />
      </div>
    </nav>
  );
}
