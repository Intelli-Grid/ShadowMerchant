"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';

const UNIVERSAL_CATEGORIES = [
  'electronics', 'fashion', 'beauty', 'home', 'sports', 'books',
  'toys', 'health', 'automotive', 'grocery', 'travel', 'gaming'
];

const inputCls = 'w-4 h-4'; // accent-gold via CSS

export function FilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCat = searchParams.get('category') || 'all';
  const currentPlat = searchParams.get('platform') || 'all';
  const currentSort = searchParams.get('sort') || 'score';
  const currentDays = searchParams.get('days') || '7';

  const updateFilters = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all' && key !== 'sort' && key !== 'days') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`/deals?${params.toString()}`);
    },
    [router, searchParams]
  );

  const sectionLabel = 'text-[10px] font-bold uppercase tracking-widest mb-3';
  const divider = { borderTop: '1px solid var(--sm-border)' };

  return (
    <aside className="w-full md:w-64 flex-shrink-0">
      <div
        className="p-6 rounded-xl sticky top-24"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-white">Filters</h3>
          {(currentCat !== 'all' || currentPlat !== 'all') && (
            <button
              onClick={() => router.push('/deals')}
              className="text-xs font-semibold transition-colors"
              style={{ color: 'var(--gold)' }}
            >
              Clear All
            </button>
          )}
        </div>

        <div className="space-y-6">

          {/* Categories */}
          <div>
            <h4 className={sectionLabel} style={{ color: 'var(--text-muted)' }}>Category</h4>
            <div className="flex flex-col space-y-2 max-h-60 overflow-y-auto pr-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="category"
                  checked={currentCat === 'all'}
                  onChange={() => updateFilters('category', 'all')}
                  className={cn(inputCls, 'accent-yellow-500')}
                />
                <span className={cn('text-sm transition-colors', currentCat === 'all' ? 'text-white font-medium' : 'group-hover:text-white')} style={{ color: currentCat === 'all' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  All Categories
                </span>
              </label>
              {UNIVERSAL_CATEGORIES.map((cat) => (
                <label key={cat} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="category"
                    checked={currentCat === cat}
                    onChange={() => updateFilters('category', cat)}
                    className={cn(inputCls, 'accent-yellow-500')}
                  />
                  <span className={cn('text-sm capitalize transition-colors', currentCat === cat ? 'font-medium' : '')} style={{ color: currentCat === cat ? 'var(--gold)' : 'var(--text-muted)' }}>
                    {cat}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={divider} className="pt-6">
            {/* Platforms */}
            <h4 className={sectionLabel} style={{ color: 'var(--text-muted)' }}>Platform</h4>
            <div className="flex flex-col space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="platform"
                  checked={currentPlat === 'all'}
                  onChange={() => updateFilters('platform', 'all')}
                  className={cn(inputCls, 'accent-yellow-500')}
                />
                <span className="text-sm transition-colors" style={{ color: currentPlat === 'all' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  Any Store
                </span>
              </label>
              {['amazon', 'flipkart', 'myntra', 'nykaa'].map((plat) => (
                <label key={plat} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="platform"
                    checked={currentPlat === plat}
                    onChange={() => updateFilters('platform', plat)}
                    className={cn(inputCls, 'accent-yellow-500')}
                  />
                  <span className="text-sm capitalize transition-colors" style={{ color: currentPlat === plat ? 'var(--gold)' : 'var(--text-muted)' }}>
                    {plat}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={divider} className="pt-6">
            {/* Timeframe */}
            <h4 className={sectionLabel} style={{ color: 'var(--text-muted)' }}>Freshness</h4>
            <div className="flex flex-col space-y-2">
              {[
                { val: '1', label: 'Last 24 Hours' },
                { val: '3', label: 'Last 3 Days' },
                { val: '7', label: 'Last 7 Days' },
                { val: '14', label: 'All Active Deals' },
              ].map(({ val, label }) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="days"
                    checked={currentDays === val || (currentDays === '7' && val === 'all')}
                    onChange={() => updateFilters('days', val)}
                    className={cn(inputCls, 'accent-yellow-500')}
                  />
                  <span className="text-sm transition-colors" style={{ color: currentDays === val ? 'var(--gold)' : 'var(--text-muted)' }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={divider} className="pt-6">
            {/* Sort */}
            <h4 className={sectionLabel} style={{ color: 'var(--text-muted)' }}>Sort By</h4>
            <select
              value={currentSort}
              onChange={(e) => updateFilters('sort', e.target.value)}
              className="w-full text-sm rounded-md px-3 py-2 outline-none"
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--sm-border)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--gold)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--sm-border)')}
            >
              <option value="score">Highest Score (AI)</option>
              <option value="discount">Biggest Discount</option>
              <option value="newest">Newest Scraped</option>
            </select>
          </div>
        </div>
      </div>
    </aside>
  );
}
