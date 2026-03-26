'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Deal } from '@/types';
import { Lock, ExternalLink, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { getPlatform } from '@/lib/platforms';

interface DealCardProps {
  deal: Deal;
  isUserPro?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DealCard({ deal, isUserPro = false, size = 'md', className }: DealCardProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [scoreVisible, setScoreVisible] = useState(false);
  const scoreBarRef = useRef<HTMLDivElement>(null);

  const isLocked = deal.is_pro_exclusive && !isUserPro;
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
        'deal-card-enter group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer',
        'hover:-translate-y-0.5',
        className
      )}
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--sm-border)',
        height: '100%',
      }}
      onMouseEnter={() => router.prefetch(`/deals/${deal._id}`)}
      onMouseLeave={() => undefined}
      // Upgrade border glow on hover via inline style trick
    >
      {/* Hover glow border effect */}
      <style jsx>{`
        article:hover {
          border-color: var(--sm-border-hover);
          box-shadow: 0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,107,44,0.08);
        }
      `}</style>

      {/* Invisible full-card link */}
      <Link
        href={`/deals/${deal._id}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${deal.title}`}
      />

      {/* ── IMAGE SECTION ── */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '4/3', background: 'var(--bg-raised)' }}>
        {deal.image_url && !imgError ? (
          <Image
            src={deal.image_url}
            alt={deal.title}
            fill
            className="object-contain p-3 transition-transform duration-500 group-hover:scale-[1.06]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: 'var(--bg-raised)' }}>
            <span className="text-4xl">{platform.emoji}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{platform.name}</span>
          </div>
        )}

        {/* Platform badge — top left */}
        <span
          className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow-md"
          style={{ background: platform.bg, color: platform.text }}
        >
          <span>{platform.emoji}</span>
          {platform.name}
        </span>

        {/* Discount badge — top right */}
        <span
          className={cn(
            'absolute top-2.5 right-2.5 z-10 rounded px-2 py-1 text-[11px] font-extrabold tracking-wide text-white shadow-md',
            isHot && 'badge-hot'
          )}
          style={{ background: 'var(--sm-accent)' }}
        >
          {deal.discount_percent}% OFF
        </span>

        {/* Wishlist button */}
        <button
          className={cn(
            'absolute bottom-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-colors hover:bg-black/70',
            wishlisted && 'heart-active'
          )}
          onClick={(e) => { e.preventDefault(); setWishlisted(w => !w); }}
          aria-label="Save to wishlist"
        >
          <Heart className={cn('h-3.5 w-3.5', wishlisted ? 'fill-red-500 text-red-500' : 'text-white')} />
        </button>
      </div>

      {/* ── CONTENT SECTION ── */}
      <div className={cn('flex flex-col flex-1 p-3.5', isLocked && 'opacity-25 blur-[2px] pointer-events-none', sizeClasses[size])}>

        {/* Score row */}
        <div className="mb-2.5 flex items-center gap-2" ref={scoreBarRef}>
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-overlay)' }}>
            <div
              className="score-bar-fill h-full rounded-full"
              style={{
                '--score-target': `${score}%`,
                backgroundColor: scoreColor,
                width: scoreVisible ? `${score}%` : '0%',
                transition: 'width 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              } as React.CSSProperties}
            />
          </div>
          <span
            className="text-[10px] font-bold min-w-[28px] text-right"
            style={{ fontFamily: 'var(--font-display)', color: scoreColor }}
          >
            {score}
          </span>
        </div>

        {/* Title */}
        <h3
          className="line-clamp-2 font-medium leading-snug mb-2"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em', minHeight: size === 'sm' ? '2.4em' : '2.8em' }}
          title={deal.title}
        >
          {deal.title}
        </h3>

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
        <div className="flex items-baseline gap-2 mt-auto mb-2.5">
          {deal.original_price > 0 && (
            <span className="text-xs line-through" style={{ color: 'var(--text-muted)' }}>
              {formatPrice(deal.original_price)}
            </span>
          )}
          <span
            className="font-bold"
            style={{ fontFamily: 'var(--font-display)', fontSize: size === 'lg' ? '22px' : '18px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            {formatPrice(deal.discounted_price)}
          </span>
        </div>

        {/* CTA */}
        <a
          href={deal.affiliate_url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'var(--sm-accent)', letterSpacing: '0.01em' }}
          onClick={(e) => e.stopPropagation()}
        >
          Get Deal
          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </a>
      </div>

      {/* Pro lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center pointer-events-auto backdrop-blur-md" style={{ background: 'rgba(10,10,11,0.6)' }}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full shadow-lg" style={{ background: '#7C3AED', boxShadow: '0 0 20px rgba(124,58,237,0.4)' }}>
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Pro Exclusive</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Flash deal for Pro members only.
          </p>
          <Link
            href="/pro"
            className="rounded-lg px-4 py-2 text-sm font-bold text-white w-full text-center"
            style={{ background: '#7C3AED' }}
          >
            Unlock with Pro →
          </Link>
        </div>
      )}
    </article>
  );
}
