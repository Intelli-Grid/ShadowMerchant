import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import Link from 'next/link';

export const revalidate = 3600; // Revalidate every hour

export default async function MissedDealsPage() {
  await connectDB();
  
  const deals = await Deal.find({
    is_active: false,
    deal_score: { $gte: 90 }
  })
    .sort({ deal_score: -1 })
    .limit(24)
    .lean();

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 border-t border-slate-800">
      <Navbar />

      <main className="flex-grow container mx-auto px-4 py-12 md:py-20 mt-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tighter">
            The Deal <span className="text-red-500">Morgue</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl">
            These historical lows are gone forever. 
            Smart shoppers grabbed them because they were subscribed to our Telegram alerts.
          </p>
          
          <div className="mt-10 p-6 bg-slate-800/50 border border-red-900/50 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-left">
              <h3 className="text-white font-bold text-xl">Never Miss Another Drop</h3>
              <p className="text-slate-400 mt-1">Get real-time AI deal alerts directly on your phone.</p>
            </div>
            <a 
              href="https://t.me/ShadowMerchantDeals" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl transition shadow-xl shadow-sky-500/20 whitespace-nowrap"
            >
              Join Telegram Channel
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 grayscale opacity-60">
          {deals.map((deal: any) => (
            <div key={deal._id.toString()} className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 relative">
              {/* EXPIRED OVERLAY */}
              <div className="absolute inset-0 bg-slate-900/60 z-10 flex items-center justify-center backdrop-blur-[2px]">
                <div className="border-4 border-red-500/80 text-red-500/80 font-black text-3xl px-6 py-2 uppercase tracking-widest transform -rotate-12">
                  Expired
                </div>
              </div>

              <div className="h-48 bg-white p-4 flex items-center justify-center relative">
                <div className="absolute top-3 left-3 z-0">
                  <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Score: {deal.deal_score}/100
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={deal.image_url || '/placeholder.png'} 
                  alt={deal.title}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="p-5">
                <h3 className="text-white font-medium line-clamp-2 mb-4">
                  {deal.title}
                </h3>
                <div className="flex items-end gap-3">
                  <span className="text-2xl font-bold text-slate-300">
                    ₹{(deal.discounted_price || 0).toLocaleString()}
                  </span>
                  <span className="text-sm text-slate-500 line-through mb-1">
                    ₹{(deal.original_price || 0).toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-slate-400 mb-1 ml-auto">
                    {deal.source_platform}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
