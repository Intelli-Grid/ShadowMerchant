'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { PLATFORM_CONFIG } from '@/lib/platforms';
import { Deal } from '@/types';
import { ExternalLink, Flame } from 'lucide-react';

interface HeroDealProps {
  deal: Deal | null;
}

export function HeroDeal({ deal }: HeroDealProps) {
  const [imgError, setImgError] = useState(false);
  // F2: Animate score ring from 0 → actual score on mount
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (!deal) return;
    const timer = setTimeout(() => setAnimatedScore(deal.deal_score ?? 0), 100);
    return () => clearTimeout(timer);
  }, [deal]);

  if (!deal) return null;

  const platform = PLATFORM_CONFIG[deal.source_platform] || PLATFORM_CONFIG['amazon'];
  const score = deal.deal_score ?? 0;

  const scoreText =
    score >= 85 ? 'Essential Grab' :
    score >= 70 ? 'Great Value' :
    'Good Deal';

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <section className="w-full relative overflow-hidden py-10 md:py-16 mt-[-1px]">
      {/* Background radial accent */}
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
            borderColor: 'var(--gold-border)',
            boxShadow: '0 32px 64px -16px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,168,76,0.08)',
          }}
        >
          {/* Left Text Column */}
          <div className="p-8 md:p-12 md:col-span-7 flex flex-col justify-center relative">
            {/* Gold left accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5"
              style={{ background: 'linear-gradient(to bottom, var(--gold-bright), var(--gold))' }}
            />

            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-6">
              <span
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                style={{
                  background: 'var(--gold-dim)',
                  color: 'var(--gold)',
                  border: '1px solid var(--gold-border)',
                }}
              >
                <Flame className="w-3.5 h-3.5" /> Deal of the Day
              </span>
              <span
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded"
                style={{ background: platform.bg, color: platform.text }}
              >
                {platform.emoji} {platform.name}
              </span>
            </div>

            {/* Title */}
            <h1
              className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6 leading-tight tracking-tight group-hover:underline decoration-white/20 underline-offset-4 line-clamp-3 sm:line-clamp-4"
              style={{ fontFamily: 'var(--font-display)', color: 'white' }}
              title={deal.title}
            >
              {deal.title}
            </h1>

            {/* Price & Score Row */}
            <div className="flex flex-wrap items-end gap-6 mb-8 pb-8 border-b" style={{ borderColor: 'var(--sm-border)' }}>
              <div className="flex flex-col">
                <span className="text-sm font-medium line-through mb-1" style={{ color: 'var(--text-muted)' }}>
                  {formatPrice(deal.original_price)}
                </span>
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-4xl md:text-5xl font-extrabold tracking-tighter price-display"
                    style={{ fontFamily: 'var(--font-display)', color: 'white' }}
                  >
                    {formatPrice(deal.discounted_price)}
                  </span>
                  {/* Gold discount badge */}
                  <span
                    className="text-lg font-bold px-3 py-1 rounded"
                    style={{
                      background: 'var(--gold)',
                      color: '#0A0A0A',
                      boxShadow: '0 0 12px rgba(201,168,76,0.3)',
                    }}
                  >
                    -{deal.discount_percent}%
                  </span>
                </div>
                {/* C1: Star rating below price */}
                {(deal.rating || deal.rating_count) && (
                  <div className="flex items-center gap-1.5 mt-2" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <span style={{ color: '#F59E0B' }}>★</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {deal.rating?.toFixed(1) ?? 'N/A'}
                    </span>
                    <span>({deal.rating_count?.toLocaleString('en-IN') ?? 0} reviews)</span>
                  </div>
                )}
              </div>

              <div className="w-[1px] h-[60px] hidden md:block" style={{ background: 'var(--sm-border)' }} />

              {/* Gold Score Ring */}
              <div className="flex items-center gap-4 pl-0 md:pl-2">
                <div className="flex flex-col items-center justify-center relative w-[68px] h-[68px]">
                  <svg className="w-full h-full transform -rotate-90 absolute" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" stroke="var(--bg-raised)" />
                    <circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      strokeWidth="8"
                      stroke="var(--gold)"
                      strokeDasharray="282.7"
                      strokeDashoffset={282.7 - (282.7 * animatedScore) / 100}
                      strokeLinecap="round"
                      style={{
                        filter: 'drop-shadow(0 0 6px rgba(201,168,76,0.4))',
                        transition: 'all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      }}
                    />
                  </svg>
                  <span className="text-xl font-black z-10" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>
                    {score}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-wide uppercase" style={{ color: 'var(--gold)' }}>
                    Shadow Score
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {scoreText}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA — gold with hover glow */}
            <button
              className="flex items-center justify-center gap-2 w-full sm:w-auto h-14 px-8 rounded-xl font-bold text-[15px] transition-all active:scale-[0.98]"
              style={{ background: 'var(--gold)', color: '#0A0A0A' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px rgba(201,168,76,0.4)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
              onClick={(e) => { e.preventDefault(); window.open(`/api/go/${deal._id}`, '_blank'); }}
            >
              Get this Deal <ExternalLink className="w-4 h-4 opacity-80" />
            </button>

            {/* D4: WhatsApp channel subscribe CTA */}
            <a
              href="https://whatsapp.com/channel/0029Vb7dimp1XquQpiaSWQ1N"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mt-4 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ color: '#25D366' }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="#25D366" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Get tomorrow's Deal of the Day on WhatsApp →
            </a>
          </div>

          {/* Right Image Column */}
          <div className="md:col-span-5 relative w-full aspect-square md:aspect-auto flex items-center justify-center p-8 bg-white">
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/10 to-transparent" />
            {deal.image_url && !imgError ? (
              <div className="relative w-full h-full max-w-[85%] max-h-[85%] z-10 transition-transform duration-700 group-hover:scale-105">
                <Image
                  src={deal.image_url}
                  alt={deal.title}
                  fill
                  className="object-contain mix-blend-multiply"
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 560px"
                  priority
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3">
                <span className="text-8xl">{platform.emoji}</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{platform.name}</span>
              </div>
            )}
          </div>
        </Link>
      </div>
    </section>
  );
}
