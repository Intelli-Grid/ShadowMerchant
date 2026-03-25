import Image from 'next/image';
import { notFound } from 'next/navigation';
import { DealCard } from '@/components/deals/DealCard';
import { PriceHistoryChart } from '@/components/deals/PriceHistoryChart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ExternalLink, ShieldCheck, Clock } from 'lucide-react';
import { Deal } from '@/types';

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

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDealDetails(id);
  
  if (!data || !data.deal) {
    notFound();
  }

  const { deal, price_history, similar_deals } = data;

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Section */}
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* Left Side: Product Shot */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-xl aspect-square relative p-8 shadow-xl shadow-white/5 mx-auto max-w-md w-full">
            {deal.image_url ? (
              <Image
                src={deal.image_url}
                alt={deal.title}
                fill
                className="object-contain mix-blend-multiply p-6"
                priority
              />
            ) : (
              <div className="w-full h-full flex bg-gray-100 rounded items-center justify-center text-gray-500">No Image</div>
            )}
          </div>
        </div>

        {/* Right Side: Product Meta */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex gap-2 items-center mb-4">
            <Badge className="bg-[#FF6B00]/10 text-[#FF6B00] hover:bg-[#FF6B00]/20 font-bold px-3 py-1 uppercase">{deal.source_platform}</Badge>
            {deal.is_pro_exclusive && (
              <Badge className="bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20 font-bold px-3 py-1">PRO EXCLUSIVE</Badge>
            )}
            <Badge className="bg-[#00C853] text-black font-extrabold px-3 py-1">{deal.discount_percent}% OFF</Badge>
          </div>

          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white mb-4 leading-tight">
            {deal.title}
          </h1>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-1.5 text-sm">
              <Star className="w-4 h-4 fill-[#FFB400] text-[#FFB400]" />
              <span className="font-bold text-gray-200">{deal.rating?.toFixed(1) || 'N/A'}</span>
              <span className="text-gray-500">({deal.rating_count?.toLocaleString() || 0} reviews)</span>
            </div>
            <div className="h-4 w-px bg-gray-800"></div>
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <ShieldCheck className="w-4 h-4 text-green-500" /> Authorized Source
            </div>
          </div>

          <div className="bg-[#1A1A24] p-5 rounded-xl border border-[#2A2A35] flex items-center justify-between mb-8 shadow-lg shadow-black">
            <div>
              <p className="text-gray-500 text-sm font-semibold mb-1 line-through">₹{deal.original_price.toLocaleString('en-IN')}</p>
              <p className="text-4xl font-black text-white text-shadow shadow-[#FF6B00]/20">₹{deal.discounted_price.toLocaleString('en-IN')}</p>
            </div>
            
            <Button asChild size="lg" className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-extrabold px-8 h-14 text-lg">
              <a href={deal.affiliate_url} target="_blank" rel="noopener noreferrer">
                Buy Now <ExternalLink className="w-5 h-5 ml-2" />
              </a>
            </Button>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-400 bg-[#FF6B00]/5 border border-[#FF6B00]/20 p-4 rounded-lg">
            <Clock className="w-5 h-5 text-[#FF6B00]" />
            <p><strong>Warning:</strong> Flash deals expire quickly. Prices are guaranteed only at the time of scraping.</p>
          </div>
        </div>
      </div>

      <hr className="border-[#2A2A35] my-12" />

      {/* Bottom Section: Graph and Similar Deals */}
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* Left Side: Graph */}
        <div className="w-full lg:w-2/3">
          <h2 className="text-xl font-bold text-white mb-6 tracking-tight">Price Tracking History</h2>
          <PriceHistoryChart data={price_history || []} />
          
          {deal.description && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4 tracking-tight">About this Deal</h2>
              <div className="text-gray-400 leading-relaxed space-y-4" dangerouslySetInnerHTML={{ __html: deal.description }} />
            </div>
          )}
        </div>

        {/* Right Side: Similar Deals */}
        <div className="w-full lg:w-1/3">
          <h2 className="text-xl font-bold text-white mb-6 tracking-tight">Compare Similar Deals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {similar_deals?.length > 0 ? (
              similar_deals.map((similarDeal: Deal) => (
                <div key={similarDeal._id} className="h-64 sm:h-auto lg:h-64">
                  <DealCard deal={similarDeal} />
                </div>
              ))
            ) : (
              <div className="w-full h-32 flex items-center justify-center bg-[#1A1A24] rounded-xl border border-[#2A2A35]">
                <p className="text-gray-500 text-sm">No similar deals found.</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </main>
  );
}
