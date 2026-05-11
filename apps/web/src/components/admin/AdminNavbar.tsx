'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  TrendingUp,
  DollarSign,
  BarChart3,
  ExternalLink,
  Zap,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/agents/scraper', label: 'Scraper', icon: Bot },
  { href: '/admin/agents/content', label: 'Content', icon: TrendingUp },
  { href: '/admin/agents/revenue', label: 'Revenue', icon: DollarSign },
  { href: '/admin/agents/growth', label: 'Growth', icon: BarChart3 },
];

export function AdminNavbar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b"
      style={{
        background: 'rgba(8,8,8,0.92)',
        borderColor: 'var(--sm-border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <Zap className="w-4 h-4" style={{ color: 'var(--gold)' }} />
        <span
          className="text-sm font-black tracking-widest"
          style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)' }}
        >
          MISSION CONTROL
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded font-bold"
          style={{
            background: 'rgba(201,168,76,0.1)',
            color: 'var(--gold)',
            border: '1px solid var(--gold-border)',
          }}
        >
          ADMIN
        </span>
      </div>

      {/* Nav items */}
      <div className="flex items-center gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== '/admin' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: active ? 'var(--gold-dim)' : 'transparent',
                color: active ? 'var(--gold)' : 'var(--text-secondary)',
                border: active
                  ? '1px solid var(--gold-border)'
                  : '1px solid transparent',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* External quick links */}
      <div className="flex items-center gap-4">
        <a
          href="https://www.shadowmerchant.online"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          Live Site <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          GitHub Actions <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </nav>
  );
}
