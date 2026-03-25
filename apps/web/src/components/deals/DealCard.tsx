"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Deal } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Lock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface DealCardProps {
  deal: Deal;
  isUserPro?: boolean;
}

export function DealCard({ deal, isUserPro = false }: DealCardProps) {
  const [isLocked] = useState(deal.is_pro_exclusive && !isUserPro);
  const [imgError, setImgError] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price);
  };

  const platformColors: Record<string, string> = {
    amazon: 'bg-[#FF9900] text-black',
    flipkart: 'bg-[#2874F0] text-white',
    myntra: 'bg-[#FF3F6C] text-white',
    meesho: 'bg-[#F43397] text-white',
    nykaa: 'bg-[#FC2779] text-white',
    croma: 'bg-[#00E9BF] text-black',
  };

  return (
    <div className="relative group w-full bg-[#13131A] rounded-xl border border-[#2A2A35] overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-[#FF6B00]/10 flex flex-col h-full">
      <Link href={`/deals/${deal._id}`} className="absolute inset-0 z-0" aria-label={`View details for ${deal.title}`} />

      {/* Platform Badge Label */}
      <div className="absolute top-3 left-3 z-10 font-bold uppercase tracking-wider text-[10px] px-2 py-1 rounded-sm shadow-md" style={{ background: platformColors[deal.source_platform]?.split(' ')[0], color: platformColors[deal.source_platform]?.split(' ')[2] }}>
        {deal.source_platform}
      </div>

      {/* Discount Badge */}
      <div className="absolute top-3 right-3 z-10 bg-[#00C853] text-black font-extrabold text-xs px-2 py-1 rounded shadow-md">
        {deal.discount_percent}% OFF
      </div>

      {/* Product Image Area */}
      <div className="relative w-full aspect-square bg-[#FFFFFF] p-4 flex items-center justify-center">
        {deal.image_url && !imgError ? (
          <Image
            src={deal.image_url}
            alt={deal.title}
            fill
            className="object-contain mix-blend-multiply p-4"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#13131A] to-[#1E1E2E] gap-2">
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center font-black text-xl shadow-lg"
              style={{ background: platformColors[deal.source_platform] || 'bg-gray-700' }}
            >
              {deal.source_platform?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-gray-500 text-xs capitalize">{deal.source_platform}</span>
          </div>
        )}
      </div>

      {/* Action / Lock Content Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 bg-background/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center pointer-events-auto">
          <div className="w-12 h-12 bg-[#7C3AED] rounded-full flex items-center justify-center mb-4 shadow-lg shadow-[#7C3AED]/40">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Pro Exclusive</h3>
          <p className="text-sm text-gray-300 mb-4 line-clamp-2">This is a highly discounted flash deal only accessible to Pro members.</p>
          <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white w-full font-bold relative z-30">
            Unlock with Pro
          </Button>
        </div>
      )}

      {/* Information Area */}
      <div className={cn("p-4 flex flex-col flex-grow", isLocked && "opacity-20 blur-[2px] pointer-events-none")}>
        
        {/* Deal Score Bar */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000" 
              style={{ 
                width: `${deal.deal_score}%`, 
                backgroundColor: deal.deal_score >= 80 ? '#FF6B00' : deal.deal_score >= 60 ? '#F59E0B' : '#10B981'
              }}
            />
          </div>
          <span className="text-[10px] text-gray-400 font-bold w-14 text-right">
            SCORE: {deal.deal_score}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[#F0F0F0] font-semibold text-sm line-clamp-2 mb-3 min-h-[40px]" title={deal.title}>
          {deal.title}
        </h3>

        {/* Rating and Reviews */}
        {(deal.rating || deal.rating_count) ? (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-400">
            <Star className="w-3.5 h-3.5 fill-[#FFB400] text-[#FFB400]" />
            <span className="font-medium text-gray-300">{deal.rating?.toFixed(1) || 'N/A'}</span>
            <span>({deal.rating_count?.toLocaleString() || 0})</span>
          </div>
        ) : (
          <div className="h-6 mb-3" />
        )}

        {/* Pricing & CTA */}
        <div className="mt-auto flex items-end justify-between gap-2 relative z-30 pointer-events-auto">
          <div className="flex flex-col">
            <span className="text-gray-500 line-through text-xs font-medium">
              {formatPrice(deal.original_price)}
            </span>
            <span className="text-white font-black text-xl leading-none mt-1">
              {formatPrice(deal.discounted_price)}
            </span>
          </div>

          <Button 
            asChild
            className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold h-10 px-4 whitespace-nowrap"
          >
            <a href={deal.affiliate_url} target="_blank" rel="noopener noreferrer">
              Get Deal <ExternalLink className="w-4 h-4 ml-1.5 opacity-80" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
