import type { Metadata, ResolvingMetadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { DealCard } from '@/components/deals/DealCard';
import { PriceHistoryChart } from '@/components/deals/PriceHistoryChart';
import { PLATFORM_CONFIG } from '@/lib/platforms';
import { ShieldCheck, Clock, ExternalLink, Activity, Sparkles, TrendingDown } from 'lucide-react';
import { Deal } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { sanitizeHtml } from '@/lib/sanitize';

async function getDealDetails(id: string) {
  try {
    const { connectDB } = await import('@/lib/db');
    await connectDB();
    const Deal = (await import('@/models/Deal')).default;
    const deal = await Deal.findById(id).lean();
    if (!deal) return null;
    
    const similar_deals = await Deal.find({
      is_active: true,
      category: deal.category,
      _id: { $ne: id }
    }).sort({ deal_score: -1 }).limit(4).lean();
    
    return JSON.parse(JSON.stringify({
      deal,
      price_history: deal.price_history || [],
      similar_deals
    }));
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  const { id } = await params;
  const data = await getDealDetails(id);
  
  if (!data || !data.deal) {
    return {
      title: 'Deal Not Found | ShadowMerchant',
    };
  }

  const deal = data.deal;
  
  return {
    title: `${Math.round(deal.discount_percent)}% OFF: ${deal.title} | ShadowMerchant`,
    description: `Current Deal: ₹${deal.discounted_price.toLocaleString('en-IN')} (MSRP ₹${deal.original_price.toLocaleString('en-IN')}). Buy ${deal.title} on ${deal.source_platform}.`,
    openGraph: {
      title: `${Math.round(deal.discount_percent)}% OFF: ${deal.title}`,
      description: `Just dropped to ₹${deal.discounted_price.toLocaleString('en-IN')}! Original price: ₹${deal.original_price.toLocaleString('en-IN')}.`,
      images: deal.image_url ? [deal.image_url] : [],
      type: 'website',
    },
    alternates: {
      canonical: `/deals/${deal._id}`,
    }
  };
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();

  const [data, uinfo] = await Promise.all([
    getDealDetails(id),
    (async () => {
      if (!userId) return null;
      const { connectDB: _db } = await import('@/lib/db');
      await _db();
      const U = (await import('@/models/User')).default;
      return await U.findOne({ clerk_id: userId }, { subscription_tier: 1 }).lean();
    })()
  ]);
  
  if (!data || !data.deal) {
    notFound();
  }

  const isUserPro = uinfo?.subscription_tier === 'pro';

  const { deal, price_history, similar_deals } = data;
  const platform = PLATFORM_CONFIG[deal.source_platform] || PLATFORM_CONFIG['amazon'];
  
  const scoreConfig = {
    color: '#22C55E', // High score default
    text: 'Essential Grab',
  };

  if (deal.deal_score < 70) {
    scoreConfig.color = '#F59E0B';
    scoreConfig.text = 'Fair Price';
  }
  if (deal.deal_score < 50) {
    scoreConfig.color = '#EF4444';
    scoreConfig.text = 'Skip It';
  }

  // Generate Product JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: deal.title,
    image: deal.image_url ? [deal.image_url] : undefined,
    description: deal.description || `Buy ${deal.title} on ${platform.name}`,
    sku: deal.deal_id || deal._id,
    brand: {
      '@type': 'Brand',
      name: deal.brand || platform.name,
    },
    offers: {
      '@type': 'Offer',
      url: deal.affiliate_url || '',
      priceCurrency: 'INR',
      price: deal.discounted_price,
      priceValidUntil: deal.expires_at ? new Date(deal.expires_at).toISOString().split('T')[0] : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })(),
      itemCondition: 'https://schema.org/NewCondition',
      availability: deal.is_active ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: platform.name,
      },
    },
    aggregateRating: deal.rating_count && deal.rating_count > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: deal.rating,
      reviewCount: deal.rating_count,
    } : undefined,
  };

  return (
    <main className="flex-1 w-full pb-20 relative">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      
      {/* Brand Strip Gradient Overlay (Absolute) */}
      <div 
        className="absolute top-0 left-0 right-0 h-[40vh] min-h-[400px] -z-10 pointer-events-none opacity-10"
        style={{ background: `linear-gradient(180deg, ${platform.bg} 0%, transparent 100%)` }}
      />
      <div 
        className="absolute top-0 right-1/4 w-[800px] h-[800px] rounded-full blur-[140px] opacity-[0.08] -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2" 
        style={{ background: platform.bg }} 
      />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16">
        
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Side: Product Shot Container */}
          <div className="lg:col-span-5 w-full flex flex-col gap-6">
            <div className="sticky top-24">
              <div 
                className="bg-white rounded-[32px] aspect-square relative p-12 shadow-2xl overflow-hidden group"
                style={{ boxShadow: `0 32px 64px -16px rgba(0,0,0,0.4), 0 0 0 1px ${platform.borderColor}50` }}
              >
                {/* Internal brand glow */}
                <div 
                  className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity" 
                  style={{ background: `radial-gradient(circle at center, ${platform.bg} 0%, transparent 70%)` }} 
                />
                {deal.image_url ? (
                  <Image
                    src={deal.image_url}
                    alt={deal.title}
                    fill
                    className="object-contain mix-blend-multiply p-12 transform group-hover:scale-105 transition-transform duration-700 ease-out"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl opacity-80">{platform.emoji}</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Product Meta & Purchase */}
          <div className="lg:col-span-7 flex flex-col justify-start">
            
            {/* Tag List */}
            <div className="flex flex-wrap gap-2 items-center mb-3">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded" style={{ background: platform.bg, color: platform.text }}>
                {platform.emoji} {platform.name}
              </span>
              {deal.is_pro_exclusive && (
                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ background: 'var(--sm-accent-dim)', color: 'var(--sm-accent)' }}>
                  <Sparkles className="w-3.5 h-3.5" /> PRO EXCLUSIVE
                </span>
              )}
            </div>

            {/* Readability Fixed Title */}
            <h1 className="text-xl md:text-3xl font-medium text-white mb-3 leading-snug">
              {deal.title}
            </h1>

            {/* Ratings & Trust */}
            <div className="flex flex-wrap items-center gap-4 mb-4 pb-4" style={{ borderBottom: '1px solid var(--sm-border)' }}>
              <div className="flex items-center gap-1.5 text-sm">
                <div className="flex p-1.5 rounded" style={{ background: 'rgba(255,180,0,0.1)' }}>
                  <span className="font-black text-[#FFB400] text-sm leading-none pl-1">★ {deal.rating?.toFixed(1) || 'N/A'}</span>
                </div>
                <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>({deal.rating_count?.toLocaleString() || 0} global ratings)</span>
              </div>
              <div className="h-4 w-px bg-gray-800"></div>
              <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <ShieldCheck className="w-4 h-4 text-blue-400" /> Inspected by ShadowMerchant
              </div>
            </div>

            {/* Price & Primary Action (Amazon Look) */}
            <div className="flex flex-col mb-6">
              <div className="flex items-end gap-3 mb-1">
                <span className="text-4xl md:text-5xl font-light text-red-500">
                  -{Math.round(deal.discount_percent ?? 0)}%
                </span>
                <span className="text-4xl md:text-5xl font-bold text-white tracking-tighter flex items-start">
                  <span className="text-2xl mt-1.5 mr-0.5">₹</span>{deal.discounted_price.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-sm font-semibold line-through text-gray-500 mb-6">
                M.R.P.: ₹{deal.original_price.toLocaleString('en-IN')}
              </p>
              
              <a 
                href={`/api/go/${deal._id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-4 left-4 right-4 z-50 md:relative md:w-80 flex items-center justify-center gap-2 h-14 md:h-14 rounded-full font-bold text-base md:text-lg transition-transform active:scale-95 shadow-2xl md:shadow-none"
                style={{ background: '#FFD814', color: '#0F1111', border: '1px solid #FCD200' }}
              >
                Buy on {platform.name} <ExternalLink className="w-4 h-4" />
              </a>

              <p className="text-xs font-medium mt-3 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Activity className="w-3.5 h-3.5 text-blue-400" /> Checked {formatDistanceToNow(new Date(deal.scraped_at), { addSuffix: true })}
              </p>
            </div>

            {/* Share Tool */}
            <div className="flex items-center gap-4 mb-8">
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(
                  `🔥 Found this deal on ShadowMerchant!\n\n${deal.title}\n` +
                  `₹${deal.discounted_price.toLocaleString('en-IN')} (${Math.round(deal.discount_percent ?? 0)}% OFF)\n\n` +
                  `👉 Get it here: ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online'}/deals/${deal._id}\n`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full hover:scale-105 active:scale-95 transition-transform"
                style={{ background: 'rgba(37, 211, 102, 0.1)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.2)' }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                </svg>
                Share on WhatsApp
              </a>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-4 p-5 rounded-xl" style={{ border: '1px solid var(--gold-border)', background: 'var(--gold-glow)' }}>
              <Clock className="w-6 h-6 shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} />
              <p className="text-sm">
                <strong className="text-white block mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>Flash Deals Expire Quickly!</strong>
                <span className="text-gray-400">Inventory and discounts are completely controlled by {platform.name}. Prices are guaranteed only at the exact time of algorithmic detection. Do not wait if the score is above 80.</span>
              </p>
            </div>

            {/* Shadow Score Breakdown (Moved below disclaimer) */}
            <div className="flex items-center gap-6 p-6 rounded-[24px] border mt-8 cursor-default hover:bg-white/5 transition-colors" style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}>
              <div className="flex flex-col items-center justify-center relative w-[60px] h-[60px] shrink-0">
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
              
              <div className="flex flex-col flex-1 gap-1.5 pl-2" style={{ borderLeft: '1px solid var(--sm-border)' }}>
                <span className="text-[10px] tracking-wider uppercase font-bold" style={{ color: 'var(--text-secondary)' }}>
                  Shadow Score Breakdown
                </span>
                {[
                  { label: 'Discount', value: Math.min(100, deal.discount_percent ?? 0) },
                  { label: 'Trust', value: Math.round((deal.rating ?? 0) / 5 * 100) },
                  { label: 'Velocity', value: deal.is_trending ? 90 : 55 },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] w-12 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-raised)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: scoreConfig.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        <hr className="my-16" style={{ borderColor: 'var(--sm-border)' }} />

        {/* Bottom Section: Graph and Similar Deals */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Side: Graph */}
          <div className="lg:col-span-8 w-full flex flex-col gap-10">
            <div>
              <h2 className="text-2xl font-black mb-6" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>Pricing Intel</h2>
              <PriceHistoryChart data={price_history || []} platformColor={platform.bg} isUserPro={isUserPro} />
            </div>
            
            {deal.description && (
              <div>
                <h2 className="text-2xl font-black mb-6" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>Product Specs & Description</h2>
                <div 
                  className="p-6 md:p-8 rounded-[24px] border" 
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
                >
                  {/* sanitizeHtml strips script tags, on* handlers, and javascript: links before render */}
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-a:text-[var(--sm-accent)] text-gray-300" dangerouslySetInnerHTML={{ __html: sanitizeHtml(deal.description) }} />
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Similar Deals */}
          <div className="lg:col-span-4 w-full">
            <h2 className="text-2xl font-black mb-6" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>Competitor Deals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
              {similar_deals?.length > 0 ? (
                similar_deals.map((similarDeal: Deal) => (
                  <DealCard key={similarDeal._id} deal={similarDeal} size="sm" />
                ))
              ) : (
                <div className="w-full h-40 flex items-center justify-center rounded-[24px] border border-dashed font-medium" style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)', color: 'var(--text-muted)' }}>
                  No competing deals found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
