'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { DealCard } from './deals/DealCard';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Deal } from '@/types';
import { EmailCaptureInline } from '@/components/EmailCaptureInline';

interface CategorySwimlaneProps {
  title: string;
  emoji: string;
  categorySlug: string;
  deals: Deal[];
  totalDeals?: number;
}

export function CategorySwimlane({ title, emoji, categorySlug, deals, totalDeals }: CategorySwimlaneProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftNav, setShowLeftNav] = useState(false);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setShowLeftNav(container.scrollLeft > 20);
    }
  };

  // UPGRADE-L / Sprint 4B: Empty state — replace "Scanning" / null with a helpful prompt
  if (!deals || deals.length === 0) {
    return (
      <section className="w-full mb-10 overflow-hidden">
        <div className="flex items-center gap-3 mb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <span className="text-2xl">{emoji}</span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {title}
          </h2>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-2xl py-14 px-6 text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
          >
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-white font-bold text-lg mb-2">
              We're building out {title}
            </h3>
            <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Our deal tracker is warming up for this category. Want a heads-up when the first deals land?
            </p>
            <EmailCaptureInline
              source={`empty_category_${categorySlug}`}
              placeholder="Your email — we'll notify you"
              ctaLabel="Notify Me →"
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full mb-10 overflow-hidden">
      {/* Swimlane Header */}
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {title}
          </h2>
          {totalDeals && (
            <span className="hidden sm:inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
              {totalDeals}
            </span>
          )}
        </div>
        <Link
          href={`/category/${categorySlug}`}
          className="text-sm font-semibold flex items-center gap-1 transition-colors hover:opacity-80"
          style={{ color: 'var(--sm-accent)' }}
        >
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Scrollable Container Area */}
      <div className="relative group">
        {/* Nav Buttons (Desktop only) */}
        {showLeftNav && (
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 opacity-0 group-hover:opacity-100"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)', color: 'var(--text-primary)' }}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 opacity-0 group-hover:opacity-100"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)', color: 'var(--text-primary)' }}
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* The Track */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto gap-4 md:gap-5 pb-6 pt-2 snap-x snap-mandatory no-scrollbar w-full sm:px-6 lg:px-8 max-w-[1400px] mx-auto"
          style={{ paddingLeft: 'clamp(16px, 4vw, 32px)', paddingRight: 'clamp(16px, 4vw, 32px)' }}
        >
          {deals.map((deal) => (
            <div key={deal._id} className="snap-start shrink-0 flex-none" style={{ width: 'min(280px, 85vw)' }}>
              <DealCard deal={deal} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
