import { connectDB } from '@/lib/db';

import Deal from '@/models/Deal';

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



        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

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



        {/* WhatsApp Exit CTA — single channel follow, consistent with homepage */}

        <div className="mt-16 text-center max-w-2xl mx-auto px-4 pb-12">

          <p className="text-slate-400 text-sm mb-2 font-medium">

            Don&apos;t let this happen again.

          </p>

          <p className="text-slate-500 text-xs mb-6">

            Follow our WhatsApp Channel and get deal picks before they expire — it&apos;s free.

          </p>

          <a

            href="https://whatsapp.com/channel/0029Vb7dimp1XquQpiaSWQ1N"

            target="_blank"

            rel="noopener noreferrer"

            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"

            style={{ background: '#25D366', color: 'white' }}

          >

            <svg viewBox="0 0 24 24" width="15" height="15" fill="white" aria-hidden="true">

              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />

            </svg>

            Follow Free →

          </a>

          <p className="text-slate-600 text-[10px] mt-4 italic">

            Reply STOP anytime to opt out · No spam

          </p>

        </div>

      </main>

    </div>

  );

}
