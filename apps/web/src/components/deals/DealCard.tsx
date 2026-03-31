'use client';

import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Deal } from '@/types';
import { Lock, ExternalLink, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { getPlatform } from '@/lib/platforms';
import { useWishlist } from '@/context/WishlistContext';

interface DealCardProps {
  deal: Deal;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DealCard({ deal, size = 'md', className }: DealCardProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isWishlisted, toggle } = useWishlist();
  const [imgError, setImgError] = useState(false);
  const [scoreVisible, setScoreVisible] = useState(false);
  const scoreBarRef = useRef<HTMLDivElement>(null);

  const wishlisted = isWishlisted(String(deal._id));

  const platform = getPlatform(deal.source_platform);
  const score = deal.deal_score ?? 0;
  const isHot = score >= 90;

  const scoreColor =
    score >= 80 ? 'var(--score-high)' :
    score >= 55 ? 'var(--score-mid)' :
    'var(--score-low)';

  // Intersection observer — animate score bar when card enters viewport
  useEffect(() => {
    const el = scoreBarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setScoreVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <article
      className={cn(
        'deal-card-enter group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-200',
        'hover:-translate-y-0.5',
        className
      )}
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--sm-border)',
        height: '100%',
      }}
      onMouseEnter={() => router.prefetch(`/deals/${deal._id}`)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`);
      }}
    >

      {/* ── IMAGE SECTION — clicking the image navigates to deal detail ── */}
      <Link
        href={`/deals/${deal._id}`}
        className="relative overflow-hidden shrink-0 w-full flex items-center justify-center aspect-square md:aspect-[4/3] border-b p-2 sm:p-3 block"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
        aria-label={`View ${deal.title}`}
      >
        <div className="relative w-full h-full bg-white rounded-lg shadow-inner overflow-hidden flex items-center justify-center">
          {deal.image_url && !imgError ? (
            <Image
              src={deal.image_url}
              alt={deal.title}
              fill
              className="object-contain mix-blend-multiply p-2 transition-transform duration-300 group-hover:scale-[1.05]"
              sizes="(max-width: 640px) 135px, (max-width: 1024px) 33vw, 260px"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-black/50">
              <span className="text-4xl opacity-80">{platform.emoji}</span>
              <span className="text-xs font-semibold">{platform.name}</span>
            </div>
          )}
        </div>

        {/* Platform badge */}
        <span
          className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-center gap-1 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-md"
          style={{ background: platform.bg, color: platform.text }}
        >
          <span>{platform.emoji}</span>
          <span className="hidden sm:inline">{platform.name}</span>
        </span>

        {/* Wishlist button */}
        <button
          className={cn(
            'absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 z-10 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-colors hover:bg-black/70',
            wishlisted && 'heart-active'
          )}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isSignedIn) { window.location.href = '/sign-in'; return; }
            await toggle(String(deal._id));
          }}
          aria-label="Save to wishlist"
        >
          <Heart className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', wishlisted ? 'fill-red-500 text-red-500' : 'text-white')} />
        </button>
      </Link>

      {/* ── CONTENT SECTION ── */}
      <div className={cn('flex flex-col flex-1 p-3 sm:p-3.5 min-w-0', sizeClasses[size])}>

        {/* Score row with tooltip */}
        <div className="mb-2.5 flex items-center gap-2 group/score relative" ref={scoreBarRef}>
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-overlay)' }}>
            <div
              className="score-bar-fill h-full rounded-full"
              style={{
                '--score-target': `${score}%`,
                backgroundColor: scoreColor,
                width: scoreVisible ? `${score}%` : '0%',
                transition: 'width 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                boxShadow: score >= 80 ? `0 0 6px ${scoreColor}80` : 'none',
              } as React.CSSProperties}
            />
          </div>
          <span
            className="text-[10px] font-bold min-w-[28px] text-right"
            style={{ fontFamily: 'var(--font-display)', color: scoreColor }}
          >
            {score}
          </span>

          {/* Score tooltip */}
          <div
            className="absolute bottom-full left-0 mb-2 w-48 p-2.5 rounded-lg text-xs opacity-0 group-hover/score:opacity-100 pointer-events-none transition-opacity z-30"
            style={{
              background: 'var(--bg-overlay)',
              border: '1px solid var(--gold-border)',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Deal Score {score}/100</span>
            <br />
            Based on discount %, rating &amp; brand trust.
          </div>
        </div>

        {/* Title — clicking navigates to deal detail page */}
        <Link
          href={`/deals/${deal._id}`}
          className="line-clamp-2 font-medium leading-snug mb-2 hover:text-[var(--gold)] transition-colors"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em', minHeight: size === 'sm' ? '2.4em' : '2.8em', display: '-webkit-box' }}
          title={deal.title}
        >
          {deal.title}
        </Link>

        {/* Rating */}
        {(deal.rating || deal.rating_count) ? (
          <div className="flex items-center gap-1 mb-2" style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
            <span style={{ color: '#F59E0B' }}>★</span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {deal.rating?.toFixed(1) ?? 'N/A'}
            </span>
            <span>({deal.rating_count?.toLocaleString('en-IN') ?? 0})</span>
          </div>
        ) : (
          <div className="mb-2" style={{ height: '16px' }} />
        )}

        {/* Pricing */}
        <div className="flex flex-col mt-auto mb-3 gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className="font-black price-display tracking-tight"
              style={{ fontSize: size === 'lg' ? '22px' : '19px', color: 'var(--text-primary)' }}
            >
              {formatPrice(deal.discounted_price)}
            </span>
            {Math.round(deal.discount_percent ?? 0) > 0 && (
              <span 
                className={cn("text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded", isHot && "animate-pulse")}
                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
              >
                {Math.round(deal.discount_percent)}% OFF
              </span>
            )}
          </div>
          {deal.original_price > 0 && (
            <span className="text-[11px] sm:text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              M.R.P: <span className="line-through">{formatPrice(deal.original_price)}</span>
            </span>
          )}
        </div>

        {/* CTA — gold; Meesho uses 'Browse Deal' since it links to a catalog page */}
        <a
          href={`/api/go/${deal._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="deal-card-cta relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-[13px] font-bold transition-all active:scale-[0.98] mt-2 sm:mt-0"
          style={{
            background: 'var(--gold)',
            color: '#0A0A0A',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(201,168,76,0.3)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {deal.source_platform === 'meesho' ? 'Browse Deal' : 'Get Deal'}
          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </a>
      </div>


    </article>
  );
}
