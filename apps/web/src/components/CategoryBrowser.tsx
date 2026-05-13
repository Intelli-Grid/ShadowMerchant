"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Laptop, Shirt, Sparkles, Home, Dumbbell, BookOpen, Gamepad2, Car, ShoppingBasket, Plane, Baby, AlertTriangle, Clock } from 'lucide-react';

// ─── Category metadata ────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { icon: any; color: string; bg: string }> = {
  electronics:  { icon: Laptop,          color: '#60A5FA', bg: 'rgba(96,165,250,0.12)'  },
  fashion:      { icon: Shirt,           color: '#F472B6', bg: 'rgba(244,114,182,0.12)' },
  beauty:       { icon: Sparkles,        color: '#C084FC', bg: 'rgba(192,132,252,0.12)' },
  home:         { icon: Home,            color: '#34D399', bg: 'rgba(52,211,153,0.12)'  },
  sports:       { icon: Dumbbell,        color: '#FBBF24', bg: 'rgba(251,191,36,0.12)'  },
  books:        { icon: BookOpen,        color: '#818CF8', bg: 'rgba(129,140,248,0.12)' },
  toys:         { icon: Baby,            color: '#FB923C', bg: 'rgba(251,146,60,0.12)'  },
  health:       { icon: Sparkles,        color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)'  },
  automotive:   { icon: Car,             color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
  grocery:      { icon: ShoppingBasket,  color: '#A3E635', bg: 'rgba(163,230,53,0.12)'  },
  travel:       { icon: Plane,           color: '#22D3EE', bg: 'rgba(34,211,238,0.12)'  },
  gaming:       { icon: Gamepad2,        color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
};

// Which platforms serve which categories (for scraper-status mapping)
const CATEGORY_PLATFORM_MAP: Record<string, string[]> = {
  electronics: ['amazon', 'croma', 'flipkart'],
  fashion:     ['myntra', 'meesho', 'flipkart'],
  beauty:      ['nykaa', 'myntra'],
  home:        ['amazon', 'flipkart'],
  sports:      ['amazon', 'flipkart'],
  books:       ['amazon', 'flipkart'],
  toys:        ['amazon', 'flipkart'],
  health:      ['nykaa', 'amazon'],
  automotive:  ['amazon'],
  grocery:     ['amazon'],
  travel:      ['amazon', 'flipkart'],
  gaming:      ['amazon', 'croma'],
};

const UNIVERSAL_CATEGORIES = [
  'electronics', 'fashion', 'beauty', 'home', 'sports', 'books',
  'toys', 'health', 'automotive', 'grocery', 'travel', 'gaming'
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category {
  category: string;
  count: number;
  avg_discount: number;
}

interface ScraperStatusEntry {
  store: string;
  status: 'ok' | 'failed' | 'timeout' | 'never_run';
  freshness: 'green' | 'amber' | 'red' | 'unknown';
  minutes_ago: number | null;
  items_found: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * FIX-DAY5: Derive the honest empty-state label for a category.
 *
 * Three states (from the audit):
 *  1. Scraper currently running < 5 min  → "Scanning now…"
 *  2. Last scanned > 24h ago OR failed   → "No deals found recently"
 *  3. Scraper ok but 0 items             → "Temporarily unavailable"
 */
function getCategoryStatus(
  category: string,
  scraperMap: Record<string, ScraperStatusEntry>
): 'active' | 'scanning' | 'unavailable' | 'no_deals' {
  const platforms = CATEGORY_PLATFORM_MAP[category] ?? [];
  const statuses  = platforms.map(p => scraperMap[p]).filter(Boolean);

  if (statuses.length === 0) return 'no_deals';

  // Is any platform currently scanning (ran < 5 min ago, status ok)?
  const isScanning = statuses.some(
    s => s.status === 'ok' && s.minutes_ago !== null && s.minutes_ago < 5
  );
  if (isScanning) return 'scanning';

  // Is every relevant platform dead / never run / > 24h stale?
  const allDead = statuses.every(
    s =>
      s.status === 'failed' ||
      s.status === 'timeout' ||
      s.status === 'never_run' ||
      (s.minutes_ago !== null && s.minutes_ago > 1440)
  );
  if (allDead) return 'no_deals';

  return 'unavailable'; // Scraper ok but items_found = 0 this run
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CategoryBrowser() {
  const [dbCategories, setDbCategories]   = useState<Category[]>([]);
  const [scraperMap, setScraperMap]       = useState<Record<string, ScraperStatusEntry>>({});
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    // Fetch category deal counts and scraper health in parallel
    Promise.all([
      fetch('/api/categories').then(r => r.json()).catch(() => []),
      fetch('/api/scraper/status').then(r => r.json()).catch(() => ({ scrapers: [] })),
    ]).then(([catData, statusData]) => {
      if (Array.isArray(catData)) setDbCategories(catData);

      // Index scraper statuses by platform name for O(1) lookup
      const sMap: Record<string, ScraperStatusEntry> = {};
      for (const entry of (statusData?.scrapers ?? [])) {
        sMap[entry.store] = entry;
      }
      setScraperMap(sMap);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <section id="categories" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 scroll-mt-24">
      {/* Section heading */}
      <div className="flex items-center justify-between mb-8">
        <h2
          className="text-2xl font-bold section-heading"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          Shop by Category
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {UNIVERSAL_CATEGORIES.map((category) => {
          if (loading) {
            return <div key={category} className="skeleton-shimmer h-[120px] rounded-xl" />;
          }

          const meta = CATEGORY_META[category] || {
            icon: Laptop,
            color: 'var(--gold)',
            bg: 'var(--gold-dim)',
          };
          const Icon = meta.icon;

          const dbStat      = dbCategories.find(c => c.category === category);
          const count       = dbStat ? dbStat.count : 0;
          const avg_discount = dbStat ? Math.round(dbStat.avg_discount) : 0;

          // FIX-DAY5: determine honest empty state from scraper health
          const catStatus = getCategoryStatus(category, scraperMap);

          return (
            <Link
              key={category}
              href={`/category/${category}`}
              className="group relative flex flex-col items-center text-center rounded-xl p-4 transition-all duration-200 hover:scale-[1.04]"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--sm-border)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = meta.color + '50';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${meta.color}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--sm-border)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              {/* Icon bubble */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110"
                style={{
                  background:  meta.bg,
                  boxShadow:   `0 0 20px ${meta.color}25`,
                }}
              >
                <Icon className="w-5 h-5" style={{ color: meta.color }} />
              </div>

              {/* Category name */}
              <p className="font-bold text-sm capitalize text-white">{category}</p>

              {/* FIX-DAY5: Honest status labels instead of "— Scanning —" */}
              {count > 0 ? (
                <>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {count} deals
                  </p>
                  {avg_discount > 0 && (
                    <span
                      className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'var(--gold-dim)',
                        color:      'var(--gold)',
                        border:     '1px solid var(--gold-border)',
                      }}
                    >
                      avg {avg_discount}% off
                    </span>
                  )}
                </>
              ) : catStatus === 'scanning' ? (
                /* State 1: pipeline currently running (< 5 min ago) */
                <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Scanning now…
                </p>
              ) : catStatus === 'no_deals' ? (
                /* State 2: last run > 24h ago or platform failed */
                <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Clock className="w-3 h-3 opacity-50" />
                  Check back later
                </p>
              ) : (
                /* State 3: scraper ok but 0 qualifying deals this run */
                <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <AlertTriangle className="w-3 h-3 opacity-40" />
                  Updating…
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
