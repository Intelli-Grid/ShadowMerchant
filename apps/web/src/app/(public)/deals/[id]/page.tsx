import type { Metadata, ResolvingMetadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { DealCard } from '@/components/deals/DealCard';
import { PriceHistoryChart } from '@/components/deals/PriceHistoryChart';
import { PLATFORM_CONFIG } from '@/lib/platforms';
import { ShieldCheck, Clock, ExternalLink, Activity, Sparkles, TrendingDown } from 'lucide-react';
import { Deal } from '@/types';
import { formatDistanceToNow } from 'date-fns';

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
  const data = await getDealDetails(id);
  
  if (!data || !data.deal) {
    notFound();
  }

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
      priceValidUntil: deal.expires_at ? new Date(deal.expires_at).toISOString().split('T')[0] : new Date(Date.now() + 86400000).toISOString().split('T')[0],
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

            {/* Score Breakdown (New feature) */}
            <div className="flex items-center gap-6 p-6 rounded-[24px] border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}>
              <div className="flex flex-col items-center justify-center relative w-[80px] h-[80px]">
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
                <span className="text-2xl font-black z-10" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>
                  {deal.deal_score}
                </span>
              </div>
              
              <div className="flex flex-col flex-1 pl-2" style={{ borderLeft: '1px solid var(--sm-border)' }}>
                <span className="text-xs tracking-wider uppercase font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Shadow Algorithm
                </span>
                <span className="text-xl font-bold" style={{ color: scoreConfig.color }}>
                  {scoreConfig.text}
                </span>
                <p className="text-xs mt-2 leading-tight" style={{ color: 'var(--text-muted)' }}>
                  Pricing history and discount velocity indicate this is an excellent time to buy.
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Product Meta & Purchase */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            
            {/* Tag List */}
            <div className="flex flex-wrap gap-2 items-center mb-6">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded" style={{ background: platform.bg, color: platform.text }}>
                {platform.emoji} {platform.name}
              </span>
              {deal.is_pro_exclusive && (
                <span className="flex items-center gap-1text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full" style={{ background: 'var(--sm-accent-dim)', color: 'var(--sm-accent)' }}>
                  <Sparkles className="w-3.5 h-3.5" /> PRO EXCLUSIVE
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded uppercase" style={{ background: 'var(--score-high)', color: '#000' }}>
                <TrendingDown className="w-4 h-4" /> {deal.discount_percent}% OFF
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {deal.title}
            </h1>

            {/* Ratings & Trust */}
            <div className="flex items-center gap-4 mb-8">
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

            {/* The Buy Strip Box */}
            <div 
              className="p-6 md:p-8 rounded-[24px] border flex flex-col md:flex-row items-center justify-between mb-8 shadow-2xl relative overflow-hidden" 
              style={{ background: 'linear-gradient(145deg, var(--bg-surface), #0f0f13)', borderColor: 'var(--sm-border)' }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-10 pointer-events-none" style={{ background: scoreConfig.color }} />
              
              <div className="flex flex-col items-center md:items-start mb-6 md:mb-0 relative z-10 w-full md:w-auto text-center md:text-left">
                <p className="text-sm font-semibold line-through mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  MSRP: ₹{deal.original_price.toLocaleString('en-IN')}
                </p>
                <div className="flex items-baseline gap-3 justify-center md:justify-start">
                  <p className="text-5xl md:text-[56px] font-black text-white tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>
                    ₹{deal.discounted_price.toLocaleString('en-IN')}
                  </p>
                </div>
                <p className="text-xs font-medium mt-2 flex items-center gap-1 justify-center md:justify-start" style={{ color: 'var(--text-secondary)' }}>
                  <Activity className="w-3.5 h-3.5" /> Checked {formatDistanceToNow(new Date(deal.scraped_at), { addSuffix: true })}
                </p>
              </div>
              
              <a 
                href={`/api/go/${deal._id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto flex items-center justify-center gap-2 h-16 px-10 rounded-xl font-bold text-lg transition-transform hover:scale-[1.02] active:scale-[0.98] z-10"
                style={{ background: platform.bg, color: platform.text }}
              >
                Buy on {platform.name} <ExternalLink className="w-5 h-5 opacity-90" />
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
          </div>
        </div>

        <hr className="my-16" style={{ borderColor: 'var(--sm-border)' }} />

        {/* Bottom Section: Graph and Similar Deals */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Side: Graph */}
          <div className="lg:col-span-8 w-full flex flex-col gap-10">
            <div>
              <h2 className="text-2xl font-black mb-6" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>Pricing Intel</h2>
              <PriceHistoryChart data={price_history || []} platformColor={platform.bg} />
            </div>
            
            {deal.description && (
              <div>
                <h2 className="text-2xl font-black mb-6" style={{ fontFamily: 'var(--font-display)', color: 'white' }}>Product Specs & Description</h2>
                <div 
                  className="p-6 md:p-8 rounded-[24px] border" 
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
                >
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-a:text-[var(--sm-accent)] text-gray-300" dangerouslySetInnerHTML={{ __html: deal.description }} />
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
