"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';

const UNIVERSAL_CATEGORIES = [
  'electronics', 'fashion', 'beauty', 'home', 'sports', 'books',
  'toys', 'health', 'automotive', 'grocery', 'travel', 'gaming'
];

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

  return (
    <aside className="w-full md:w-64 flex-shrink-0">
      <div className="bg-[#13131A] p-6 rounded-xl border border-[#2A2A35] sticky top-24">
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-white">Filters</h3>
          {(currentCat !== 'all' || currentPlat !== 'all') && (
            <button
              onClick={() => router.push('/deals')}
              className="text-xs text-[#FF6B00] hover:underline"
            >
              Clear All
            </button>
          )}
        </div>
        
        <div className="space-y-6">
          
          {/* Categories */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Category</h4>
            <div className="flex flex-col space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="category"
                  checked={currentCat === 'all'}
                  onChange={() => updateFilters('category', 'all')}
                  className="accent-[#FF6B00] w-4 h-4 bg-[#1A1A24] border-[#2A2A35] focus:ring-[#FF6B00]"
                />
                <span className={cn("text-sm transition-colors", currentCat === 'all' ? "text-white font-medium" : "text-gray-400 group-hover:text-gray-200")}>
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
                    className="accent-[#FF6B00] w-4 h-4 bg-[#1A1A24] border-[#2A2A35] focus:ring-[#FF6B00]"
                  />
                  <span className={cn("text-sm capitalize transition-colors", currentCat === cat ? "text-white font-medium" : "text-gray-400 group-hover:text-gray-200")}>
                    {cat}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <hr className="border-[#2A2A35]" />

          {/* Platforms */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Platform</h4>
            <div className="flex flex-col space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="platform"
                  checked={currentPlat === 'all'}
                  onChange={() => updateFilters('platform', 'all')}
                  className="accent-[#FF6B00] w-4 h-4 bg-[#1A1A24] border-[#2A2A35] focus:ring-[#FF6B00]"
                />
                <span className={cn("text-sm transition-colors", currentPlat === 'all' ? "text-white font-medium" : "text-gray-400 group-hover:text-gray-200")}>
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
                    className="accent-[#FF6B00] w-4 h-4 bg-[#1A1A24] border-[#2A2A35] focus:ring-[#FF6B00]"
                  />
                  <span className={cn("text-sm capitalize transition-colors", currentPlat === plat ? "text-white font-medium" : "text-gray-400 group-hover:text-gray-200")}>
                    {plat}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <hr className="border-[#2A2A35]" />

          {/* Timeframe */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Freshness</h4>
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
                    className="accent-[#FF6B00] w-4 h-4 bg-[#1A1A24] border-[#2A2A35] focus:ring-[#FF6B00]"
                  />
                  <span className={cn("text-sm transition-colors", currentDays === val ? "text-white font-medium" : "text-gray-400 group-hover:text-gray-200")}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <hr className="border-[#2A2A35]" />

          {/* Sort */}
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Sort By</h4>
            <select 
              value={currentSort}
              onChange={(e) => updateFilters('sort', e.target.value)}
              className="w-full bg-[#1A1A24] border border-[#2A2A35] text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#FF6B00]"
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
