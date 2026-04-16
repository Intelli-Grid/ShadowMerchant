'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useState } from 'react';

// Each pill links to a category page (MongoDB-backed, Algolia-independent)
const QUICK_LINKS = [
  { label: '📱 Phones',   href: '/category/electronics' },
  { label: '👗 Fashion',  href: '/category/fashion'     },
  { label: '💄 Skincare', href: '/category/beauty'      },
  { label: '🏠 Home',     href: '/category/home'        },
  { label: '🎮 Gaming',   href: '/category/gaming'      },
];

export function HeroSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={handleSearch} className="w-full">
      <div
        className="flex items-center gap-3 rounded-2xl px-5 py-3.5 transition-all duration-200 w-full"
        style={{
          background: 'var(--bg-surface)',
          border: `1.5px solid ${focused ? 'var(--gold)' : 'var(--sm-border)'}`,
          boxShadow: focused ? '0 0 0 3px rgba(201,168,76,0.12), 0 8px 32px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.2)',
        }}
      >
        <Search
          className="h-5 w-5 flex-shrink-0 transition-colors"
          style={{ color: focused ? 'var(--gold)' : 'var(--text-muted)' }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search deals across Amazon, Flipkart & more..."
          className="flex-1 bg-transparent border-none focus:outline-none text-sm sm:text-base"
          style={{
            color: 'var(--text-primary)',
            caretColor: 'var(--gold)',
          }}
        />
        <button
          type="submit"
          className="hidden sm:flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold flex-shrink-0 transition-all active:scale-95"
          style={{ background: 'var(--gold)', color: '#0A0A0A' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(201,168,76,0.3)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          Search
        </button>
      </div>

      {/* Quick category links — directly backed by MongoDB, no Algolia needed */}
      <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
        {QUICK_LINKS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="text-xs px-3 py-1 rounded-full transition-colors"
            style={{
              background: 'var(--bg-raised)',
              color: 'var(--text-muted)',
              border: '1px solid var(--sm-border)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--gold)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--gold-border)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--sm-border)';
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </form>
  );
}

