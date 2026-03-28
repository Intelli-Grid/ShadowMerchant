'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Tag, Search, Heart, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { icon: Home,   label: 'Home',   href: '/' },
  { icon: Tag,    label: 'Deals',  href: '/deals' },
  { icon: Search, label: 'Search', href: '/search' },
  { icon: Heart,  label: 'Saved',  href: '/wishlist' },
  { icon: Zap,    label: 'Pro',    href: '/pro', gold: true },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
      style={{
        background: 'rgba(10, 10, 10, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(201, 168, 76, 0.1)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV_ITEMS.map(({ icon: Icon, label, href, gold }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
        const isGold = gold || isActive;
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-opacity active:opacity-70"
          >
            <Icon
              className="w-5 h-5"
              style={{ color: isGold ? 'var(--gold)' : 'var(--text-muted)' }}
            />
            <span
              className="text-[10px] font-semibold"
              style={{ color: isGold ? 'var(--gold)' : 'var(--text-muted)' }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
