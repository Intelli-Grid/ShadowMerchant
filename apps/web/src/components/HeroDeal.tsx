'use client';

import Image from 'next/image';
import Link from 'next/link';
import { PLATFORM_CONFIG } from '@/lib/platforms';
import { Deal } from '@/types';
import { ExternalLink, Star, Trophy, Flame } from 'lucide-react';

interface HeroDealProps {
  deal: Deal | null;
}

export function HeroDeal({ deal }: HeroDealProps) {
  if (!deal) return null;

  const platform = PLATFORM_CONFIG[deal.source_platform] || PLATFORM_CONFIG['amazon'];
  const scoreConfig = {
    color: '#22C55E', // Green for high score
    text: 'Essential Grab',
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <section className="w-full relative overflow-hidden py-10 md:py-16 mt-[-1px]">
      {/* Background radial accent matches platform */}
      <div 
        className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full blur-[120px] opacity-10 pointer-events-none translate-x-1/2 -translate-y-1/2" 
        style={{ background: platform.bg }} 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex justify-center">
        <Link 
          href={`/deals/${deal._id}`}
          className="group grid grid-cols-1 md:grid-cols-12 overflow-hidden rounded-[24px] border w-full transition-all duration-300 hover:scale-[1.01]"
          style={{ 
            background: 'var(--bg-surface)', 
            borderColor: 'var(--sm-border)',
            boxShadow: `0 32px 64px -16px rgba(0,0,0,0.8), 0 0 0 1px ${platform.borderColor}`,
          }}
        >
          {/* Left Text Column */}
          <div className="p-8 md:p-12 md:col-span-7 flex flex-col justify-center relative">
            <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: platform.bg }} />

            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ background: 'var(--sm-accent-dim)', color: 'var(--sm-accent)' }}>
                <Flame className="w-3.5 h-3.5" /> Deal of the Day
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded" style={{ background: platform.bg, color: platform.text }}>
                {platform.emoji} {platform.name}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-black mb-6 leading-[1.1] tracking-tight group-hover:underline decoration-white/20 underline-offset-4" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>
              {deal.title}
            </h1>

            {/* Price & Score Row */}
            <div className="flex flex-wrap items-end gap-6 mb-8 pb-8 border-b" style={{ borderColor: 'var(--sm-border)' }}>
              <div className="flex flex-col">
                <span className="text-sm font-medium line-through mb-1" style={{ color: 'var(--text-muted)' }}>
                  {formatPrice(deal.original_price)}
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl md:text-5xl font-extrabold tracking-tighter" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>
                    {formatPrice(deal.discounted_price)}
                  </span>
                  <span className="text-lg font-bold px-2 py-1 rounded" style={{ background: 'var(--score-high)', color: '#000' }}>
                    -{deal.discount_percent}%
                  </span>
                </div>
              </div>

              <div className="w-[1px] h-[60px] hidden md:block" style={{ background: 'var(--sm-border)' }} />

              <div className="flex items-center gap-4 pl-0 md:pl-2">
                <div className="flex flex-col items-center justify-center relative w-[68px] h-[68px]">
                  <svg className="w-full h-full transform -rotate-90 absolute" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" stroke="var(--bg-raised)" />
                    <circle 
                      cx="50" cy="50" r="45" 
                      fill="none" 
                      strokeWidth="8" 
                      stroke={scoreConfig.color} 
                      strokeDasharray="282.7" 
                      strokeDashoffset={282.7 - (282.7 * (deal.deal_score ?? 0)) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <span className="text-xl font-black z-10" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>
                    {deal.deal_score}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-wide uppercase" style={{ color: scoreConfig.color }}>
                    Shadow Score
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {scoreConfig.text}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button 
              className="flex items-center justify-center gap-2 w-full sm:w-auto h-14 px-8 rounded-xl font-bold text-[15px] transition-transform active:scale-[0.98]"
              style={{ background: 'var(--sm-accent)', color: 'white' }}
              onClick={(e) => { e.preventDefault(); window.open(deal.affiliate_url || '#', '_blank'); }}
            >
              Get this Deal <ExternalLink className="w-4 h-4 opacity-80" />
            </button>
          </div>

          {/* Right Image Column */}
          <div className="md:col-span-5 relative w-full aspect-square md:aspect-auto flex items-center justify-center p-8 bg-white">
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/10 to-transparent" />
            
            {/* The product image */}
            {deal.image_url ? (
              <div className="relative w-full h-full max-w-[85%] max-h-[85%] z-10 transition-transform duration-700 group-hover:scale-105">
                <Image
                  src={deal.image_url}
                  alt={deal.title}
                  fill
                  className="object-contain mix-blend-multiply"
                  sizes="(max-width: 768px) 100vw, 40vw"
                  priority
                />
              </div>
            ) : (
              <div className="text-8xl">{platform.emoji}</div>
            )}
          </div>
        </Link>
      </div>
    </section>
  );
}
