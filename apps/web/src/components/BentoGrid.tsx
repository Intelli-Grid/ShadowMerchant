'use client';

import { DealCard } from './deals/DealCard';
import { Deal } from '@/types';
import { cn } from '@/lib/utils';
import { Sparkles, Trophy } from 'lucide-react';

interface BentoGridProps {
  deals: Deal[];
}

export function BentoGrid({ deals }: BentoGridProps) {
  if (!deals || deals.length < 5) return null; // Fallback if not enough deals

  const getBentoClass = (index: number) => {
    return 'col-span-1'; 
  };

  const getSize = (_index: number): 'sm' | 'md' | 'lg' => {
    return 'md';
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mb-8">
      {/* Editorial Header */}
      <div className="flex flex-col items-center justify-center text-center mb-10 gap-2">
        <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
          Top Picks Today
        </h2>
        <p className="text-sm md:text-base flex items-center justify-center gap-2 max-w-2xl text-balance" style={{ color: 'var(--text-secondary)' }}>
          <Sparkles className="w-4 h-4" style={{ color: 'var(--gold)' }} />
          The highest-scored deals across all categories, updated constantly.
        </p>
      </div>

      {/* CSS Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {deals.slice(0, 8).map((deal, idx) => (
          <div key={deal._id} className={cn(getBentoClass(idx), 'relative group h-full block')}>
            {idx === 0 && (
              <div className="absolute -top-3 -right-3 z-30 h-10 w-10 rounded-full flex items-center justify-center transform rotate-12 transition-transform group-hover:rotate-0" style={{ background: 'var(--gold)', boxShadow: '0 8px 16px rgba(201,168,76,0.4)' }}>
                <Trophy className="w-5 h-5 text-white" />
              </div>
            )}
            <DealCard deal={deal} size={getSize(idx)} className="h-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
