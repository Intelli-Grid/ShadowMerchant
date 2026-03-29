'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Menu, Zap, Tag, MonitorSmartphone, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/deals', label: 'Top Deals', icon: Tag },
  { href: '/category/electronics', label: 'Electronics', icon: MonitorSmartphone },
  { href: '/category/fashion', label: 'Fashion', icon: Sparkles },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);

  // Close on route change
  useEffect(() => { setTimeout(() => setOpen(false), 0); }, [pathname]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Hamburger trigger */}
      <button
        className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg md:hidden"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)' }}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="h-4 w-4" style={{ color: 'var(--text-primary)' }} />
      </button>

      {/* Portal to avoid backdrop-filter traps */}
      {mounted && createPortal(
        <>
      {open && (
        <div
          className="fixed inset-0 z-[199] backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 z-[200] flex flex-col',
          'transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{
          width: 'min(320px, 85vw)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--sm-border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--sm-border)' }}>
          <span className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Shadow<span style={{ color: 'var(--sm-accent)' }}>Merchant</span>
          </span>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:opacity-70"
            style={{ background: 'var(--bg-raised)' }}
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-1 p-4 flex-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all',
                pathname === href
                  ? 'text-white'
                  : 'hover:opacity-90'
              )}
              style={
                pathname === href
                  ? { background: 'var(--sm-accent-dim)', color: 'var(--sm-accent)' }
                  : { color: 'var(--text-secondary)' }
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          {/* Pro link */}
          <Link
            href="/pro"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold mt-1 transition-all hover:opacity-90"
            style={{ background: 'var(--sm-accent-dim)', color: 'var(--sm-accent)' }}
          >
            <Zap className="h-4 w-4" />
            ✦ Pro Features
          </Link>

          {/* Category quick links */}
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--sm-border)' }}>
            <p className="mb-2 px-3 text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>By Store</p>
            {['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa', 'croma'].map(store => (
              <Link
                key={store}
                href={`/store/${store}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm capitalize transition-all hover:opacity-90"
                style={{ color: 'var(--text-secondary)' }}
              >
                {store}
              </Link>
            ))}
          </div>
        </nav>

        {/* Footer CTA */}
        <div className="p-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--sm-border)' }}>
          <Link
            href="/sign-up"
            className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--sm-accent)' }}
          >
            Get Pro Free →
          </Link>
          <Link
            href="/sign-in"
            className="flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            Log in
          </Link>
        </div>
      </div>
      </>,
      document.body
      )}
    </>
  );
}
