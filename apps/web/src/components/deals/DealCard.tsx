'use client';

import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Deal } from '@/types';
import { Lock, ExternalLink, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { getPlatform } from '@/lib/platforms';
import { useWishlist } from '@/context/WishlistContext';
import { formatDistanceToNow } from 'date-fns';
import { ShadowScoreGauge } from '@/components/ui/ShadowScoreGauge';

interface DealCardProps {
  deal: Deal;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DealCard({ deal, size = 'md', className }: DealCardProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isWishlisted, toggle } = useWishlist();
  const [localWishlisted, setLocalWishlisted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [scoreVisible, setScoreVisible] = useState(false);
  const [priceToast, setPriceToast] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [scoreExpanded, setScoreExpanded] = useState(false); // UPGRADE-E: mobile score explainer toggle
  const scoreBarRef = useRef<HTMLDivElement>(null);

  // MED-10 fix: useLayoutEffect fires synchronously before the browser paints,
  // preventing the 1-frame flash where a wishlisted item shows as not-wishlisted.
  // (useEffect fired AFTER the first paint, causing the heart icon to flicker.)
  useLayoutEffect(() => {
    if (!isSignedIn) {
      const stored = JSON.parse(localStorage.getItem('sm_guest_wishlist') || '[]') as string[];
      setLocalWishlisted(stored.includes(String(deal._id)));
    }
  }, [isSignedIn, deal._id]);

  const wishlisted = isSignedIn ? isWishlisted(String(deal._id)) : localWishlisted;

  const platform = getPlatform(deal.source_platform);
  const score = deal.deal_score ?? 0;
  const isHot = score >= 90;

  const scoreColor =
    score >= 80 ? 'var(--score-high)' :
    score >= 60 ? '#818CF8' :
    score >= 40 ? '#F59E0B' :
    'var(--text-muted)';

  const scoreLabel =
    score >= 80 ? '🏆 Great Value' :
    score >= 60 ? '👍 Good Deal' :
    score >= 40 ? '🆗 Fair Deal' :
    '😐 Low Score';

  // T1-G: Flag suspiciously high discounts (likely data errors)
  const displayPct = Math.round(deal.discount_percent ?? 0);
  // Platform-aware suspect threshold: Meesho/Myntra/Nykaa use inflated MRP
  // so 80%+ is suspect on those platforms, vs 90%+ on Amazon/Flipkart.
  const highRiskPlatforms = ['meesho', 'myntra', 'nykaa'];
  const suspectThreshold = highRiskPlatforms.includes(deal.source_platform ?? '') ? 80 : 90;
  const isSuspect = displayPct > suspectThreshold;

  // T2-E: Flag deals scraped within the last hour
  const isNew = deal.scraped_at &&
    (Date.now() - new Date(deal.scraped_at).getTime()) < 3_600_000;

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
  // UPGRADE-B: Color-coded freshness signal based on deal age and type
  function getFreshnessSignal(scrapedAt: Date | string | undefined, dealType?: string) {
    if (!scrapedAt) return null;
    const ageH = (Date.now() - new Date(scrapedAt).getTime()) / 3_600_000;
    const isFlash = dealType === 'lightning' || dealType === 'flash';

    if (isFlash && ageH > 3) {
      return { label: '⚠️ May no longer be available', bg: 'rgba(239,68,68,0.12)', color: '#ef4444' };
    }
    if (ageH < 1)  return { label: '🟢 Just added', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' };
    if (ageH < 6)  return { label: `✓ Verified ${Math.floor(ageH)}h ago`, bg: 'rgba(34,197,94,0.08)', color: '#22c55e' };
    if (ageH < 12) return { label: `🕐 ${Math.floor(ageH)}h old — worth a quick check`, bg: 'rgba(245,158,11,0.1)', color: '#F59E0B' };
    return { label: `⚠️ ${Math.floor(ageH)}h old — please verify on platform`, bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
  }

  return (
    <article
      className={cn(
        'deal-card-enter group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-200',
        'hover:-translate-y-1 hover:shadow-2xl',
        className
      )}
      style={{
        background: 'var(--bg-surface)',
        borderColor: isHot ? 'var(--gold-border)' : 'var(--sm-border)',
        boxShadow: isHot ? '0 0 16px rgba(201,168,76,0.12)' : 'none',
        height: '100%',
      }}
      onMouseEnter={() => router.prefetch(`/deals/${deal._id}`)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        e.currentTarget.style.background =
          `radial-gradient(120px circle at ${x}px ${y}px, rgba(201,168,76,0.06), transparent 60%), var(--bg-surface)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-surface)';
      }}
    >

      {/* ── IMAGE SECTION — clicking the image navigates to deal detail ── */}
      <Link
        href={`/deals/${deal._id}`}
        className="relative overflow-hidden shrink-0 w-full flex items-center justify-center aspect-[4/5] border-b p-2 sm:p-3 block"
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
              quality={75}
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

        {/* Stale data warning badge — shown when scraper has failed 3+ consecutive runs */}
        {(deal as any).data_may_be_stale && (
          <span
            className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold shadow-md"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
            title="Price data may be outdated — our scraper is recovering"
          >
            ⚠ Stale data
          </span>
        )}

        {/* Community fire count — from reactions_cache (no extra query) */}
        {((deal as any).reactions_cache?.fire ?? 0) > 0 && (
          <span
            className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold shadow-md"
            style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}
            title="Community reaction: 🔥 Hot deal"
          >
            🔥 {(deal as any).reactions_cache.fire}
          </span>
        )}

        {/* Deal type + HOT + NEW Badges */}
        <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1 pointer-events-none">
          {((deal as any).deal_type === 'lightning' || (deal as any).deal_type === 'flash') && (
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full animate-pulse"
              style={{ background: 'rgba(239,68,68,0.9)', color: 'white' }}>
              ⚡ {(deal as any).deal_type === 'lightning' ? 'Lightning' : 'Flash'}
            </span>
          )}
          {isHot && (
            <div className="badge-hot rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ background: 'var(--gold)', color: '#0A0A0A' }}>
              🔥 HOT
            </div>
          )}
          {isNew && !isHot && (
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(59,130,246,0.85)', color: 'white' }}>
              🆕 New
            </span>
          )}

        </div>

        {/* Wishlist button */}
        <button
          className={cn(
            'absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 z-10 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-colors hover:bg-black/70',
            wishlisted && 'heart-active'
          )}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isSignedIn) {
              const guestKey = 'sm_guest_wishlist';
              const stored = JSON.parse(localStorage.getItem(guestKey) || '[]') as string[];
              const idx = stored.indexOf(String(deal._id));
              if (idx > -1) stored.splice(idx, 1);
              else stored.push(String(deal._id));
              localStorage.setItem(guestKey, JSON.stringify(stored));
              setLocalWishlisted(stored.includes(String(deal._id)));
              return;
            }
            await toggle(String(deal._id));
          }}
          aria-label="Save to wishlist"
        >
          <Heart className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', wishlisted ? 'fill-red-500 text-red-500' : 'text-white')} />
        </button>
      </Link>

      {/* ── CONTENT SECTION ── */}
      <div className={cn('flex flex-col flex-1 p-3 sm:p-3.5 min-w-0', sizeClasses[size])}>

        {/* Score — Semi-circle gauge with mobile tap explainer (UPGRADE-E+K) */}
        <div className="mb-2.5" ref={scoreBarRef}>
          <div className="flex items-center gap-3">
            <ShadowScoreGauge score={score} size={72} strokeWidth={7} showLabel={false} />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold" style={{ color: scoreColor }}>
                  {scoreLabel}
                </span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setScoreExpanded(v => !v); }}
                  className="text-[9px] font-bold px-1 rounded leading-none"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)' }}
                  aria-label="What is the Shadow Score?"
                >
                  ?
                </button>
              </div>
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                Score {score}/100
              </span>
            </div>
          </div>
          {scoreExpanded && (
            <div className="mt-2 p-2.5 rounded-lg text-[10px] leading-snug"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)', color: 'var(--text-secondary)' }}>
              <p className="font-bold text-white mb-1">What is the Shadow Score?</p>
              <p>A 0–100 score: absolute ₹ saving (30%), discount % (20%), price tier (20%), 30-day history (20%), reviews (5%), freshness (5%).</p>
              <p className="mt-1">It is <strong className="text-white">not</strong> influenced by affiliate commission rates.</p>
              <a href="/how-scoring-works" onClick={(e) => e.stopPropagation()}
                className="underline underline-offset-2 block mt-1" style={{ color: 'var(--gold)' }}>
                Full methodology →
              </a>
            </div>
          )}
        </div>

        {/* UPGRADE-F: Value-tier label — only shown for Meesho (tier: 'value') */}
        {platform.tier === 'value' && platform.trustLabel && (
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded mb-1 inline-block"
            style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)', border: '1px solid rgba(148,163,184,0.15)' }}>
            {platform.trustLabel}
          </span>
        )}

        {/* Title — clicking navigates to deal detail page */}
        <Link
          href={`/deals/${deal._id}`}
          className="line-clamp-2 font-bold leading-tight mb-2 hover:text-[var(--gold)] transition-colors"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', minHeight: size === 'sm' ? '2.4em' : '2.8em' }}
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
              className="font-extrabold price-display tracking-tighter"
              style={{ fontSize: size === 'lg' ? '24px' : '20px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              {formatPrice(deal.discounted_price)}
            </span>
            {displayPct > 0 && (
              <span
                className={cn('text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded', isHot && 'animate-pulse')}
                style={{
                  background: isSuspect ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  color: isSuspect ? '#F59E0B' : '#ef4444',
                }}
                title={isSuspect ? 'Unusually high discount — verify price on store' : undefined}
              >
                {isSuspect ? '⚠️ ' : ''}{displayPct}% OFF
              </span>
            )}
          </div>
          {deal.original_price > 0 && (
            <span className="text-[11px] sm:text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              M.R.P: <span className="line-through">{formatPrice(deal.original_price)}</span>
            </span>
          )}
          {/* UPGRADE-G: MRP clarity badges */}
          {(deal as any).mrp_verified === 'verified' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit mt-0.5"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
              ✓ Price Consistent
            </span>
          )}
          {(deal as any).mrp_verified === 'shifted' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit mt-0.5"
              title={(deal as any).mrp_note}
              style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
              ℹ️ MRP shifted recently
            </span>
          )}
        </div>

        {/* UPGRADE-J: Unavailability notice — shown when is_available is false */}
        {(deal as any).is_available === false && (
          <div className="rounded-lg px-3 py-2 text-center text-xs font-bold mb-2"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠️ Currently Unavailable — price may have changed
          </div>
        )}

        {/* UPGRADE-B: Color-coded freshness badge above CTA */}
        {(() => {
          const sig = getFreshnessSignal(deal.scraped_at, (deal as any).deal_type);
          if (!sig) return null;
          return (
            <p className="text-[10px] font-semibold text-center mb-1.5 px-2 py-1 rounded-full"
              style={{ background: sig.bg, color: sig.color }}>
              {sig.label}
            </p>
          );
        })()}

        {/* CTA — gold; Meesho uses 'Browse Deal' since it links to a catalog page */}
        <a
          href={`/api/go/${deal._id}`}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="deal-card-cta relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-[13px] font-bold transition-all active:scale-[0.98] mt-2 sm:mt-0"
          style={{
            background: validating ? 'var(--bg-overlay)' : 'var(--gold)',
            color: validating ? 'var(--text-muted)' : '#0A0A0A',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(201,168,76,0.3)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
          onClick={async (e) => {
            e.stopPropagation();
            if (validating) return;

            // UPGRADE-B fix 1.4: Only validate deals < 6h old — older deals aren't worth the latency
            const ageH = deal.scraped_at
              ? (Date.now() - new Date(deal.scraped_at).getTime()) / 3_600_000
              : 999;
            if (ageH > 6) return; // just open the link directly

            setValidating(true);
            try {
              const res = await fetch(`/api/deals/${deal._id}/validate`, { method: 'POST' });
              const data = await res.json();
              if (data.priceChanged) {
                e.preventDefault();
                setPriceToast('⚠️ Price updated! Deal may have expired.');
                setTimeout(() => setPriceToast(null), 4000);
              }
            } catch {
              // silent — don't block the user
            } finally {
              setValidating(false);
            }
          }}
        >
          {validating ? 'Checking...' : 'Get Deal →'}
          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </a>
        {/* Affiliate transparency disclosure */}
        <p className="text-[9px] text-center mt-2" style={{ color: 'var(--text-muted)' }}>
          We earn a commission.{' '}
          <a
            href="/how-scoring-works"
            onClick={(e) => e.stopPropagation()}
            className="underline underline-offset-2 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Scoring is independent →
          </a>
        </p>

        {/* WhatsApp Share button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://www.shadowmerchant.online'}/deals/${deal._id}`;
            const waText = encodeURIComponent(
              `🔥 ${Math.round(deal.discount_percent ?? 0)}% OFF — ${deal.title}\n` +
              `💰 ₹${deal.discounted_price?.toLocaleString('en-IN')} on ${deal.source_platform}\n` +
              `🛒 ${url}\n\n` +
              `More deals: https://www.shadowmerchant.online`
            );
            if (navigator.share) {
              // Mobile — native share sheet (includes WhatsApp, Messages, etc.)
              navigator.share({
                title: deal.title,
                text: `🔥 ${Math.round(deal.discount_percent ?? 0)}% OFF — ${deal.title}\n💰 ₹${deal.discounted_price?.toLocaleString('en-IN')}`,
                url,
              }).catch(() => {});
            } else {
              // Desktop — open WhatsApp Web directly with pre-formatted deal text
              window.open(`https://wa.me/?text=${waText}`, '_blank');
            }
          }}
          className="flex items-center justify-center gap-1.5 w-full mt-1.5 py-1.5 rounded text-[10px] font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{
            color: '#25D366',
            background: 'rgba(37,211,102,0.07)',
            border: '1px solid rgba(37,211,102,0.15)',
          }}
          aria-label="Share on WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="#25D366" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Share
        </button>

        {/* Old bottom timestamp removed — replaced by freshness badge above CTA (UPGRADE-B) */}

        {/* Price updated toast */}
        {priceToast && (
          <div
            className="absolute inset-x-2 bottom-2 z-50 rounded-lg px-3 py-2 text-center text-xs font-bold"
            style={{
              background: 'rgba(239,68,68,0.95)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
              animation: 'fadeInUp 0.3s ease both',
            }}
          >
            {priceToast}
          </div>
        )}
      </div>


    </article>
  );
}
