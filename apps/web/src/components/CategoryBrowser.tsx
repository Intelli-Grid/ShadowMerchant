"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Laptop, Shirt, Sparkles, Home, Dumbbell, BookOpen, Gamepad2, Car, ShoppingBasket, Plane, Baby } from 'lucide-react';

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

const UNIVERSAL_CATEGORIES = [
  'electronics', 'fashion', 'beauty', 'home', 'sports', 'books',
  'toys', 'health', 'automotive', 'grocery', 'travel', 'gaming'
];

interface Category {
  category: string;
  count: number;
  avg_discount: number;
}

export function CategoryBrowser() {
  const [dbCategories, setDbCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => Array.isArray(data) && setDbCategories(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="categories" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 scroll-mt-24">
      {/* Section heading — uses the gold bar utility class */}
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

          const dbStat = dbCategories.find(c => c.category === category);
          const count = dbStat ? dbStat.count : 0;
          const avg_discount = dbStat ? Math.round(dbStat.avg_discount) : 0;

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
                  background: meta.bg,
                  boxShadow: `0 0 20px ${meta.color}25`,
                }}
              >
                <Icon className="w-5 h-5" style={{ color: meta.color }} />
              </div>

              {/* Category name */}
              <p className="font-bold text-sm capitalize text-white">{category}</p>

              {/* Live stats */}
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
                        color: 'var(--gold)',
                        border: '1px solid var(--gold-border)',
                      }}
                    >
                      avg {avg_discount}% off
                    </span>
                  )}
                </>
              ) : (
                <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>
                  — Scanning —
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
