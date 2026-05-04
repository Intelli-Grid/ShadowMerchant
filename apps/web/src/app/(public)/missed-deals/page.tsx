import { connectDB } from '@/lib/db';
import Deal from '@/models/Deal';
import Link from 'next/link';
import Image from 'next/image';
import { BackInStockForm } from '@/components/ui/BackInStockForm';

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
    // LOW-01 fix: migrated from hard-coded Tailwind slate-* classes to the CSS
    // variable-based design system used by every other page in the app.
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--sm-border)' }}
    >
      <main className="flex-grow container mx-auto px-4 py-12 md:py-20 mt-16">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1
            className="text-4xl md:text-6xl font-black mb-6 uppercase tracking-tighter"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            The Deal <span style={{ color: 'var(--score-high)' }}>Morgue</span>
          </h1>

          <p className="text-lg md:text-xl" style={{ color: 'var(--text-secondary)' }}>
            These historical lows are gone forever.{' '}
            Smart shoppers grabbed them because they were subscribed to our Telegram alerts.
          </p>

          {/* CTA Banner */}
          <div
            className="mt-10 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--gold-border)',
            }}
          >
            <div className="text-left">
              <h3
                className="font-bold text-xl"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                Never Miss Another Drop
              </h3>
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                Get real-time AI deal alerts directly on your phone.
              </p>
            </div>
            <a
              href="https://t.me/ShadowMerchantDeals"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 font-bold rounded-xl transition shadow-xl whitespace-nowrap"
              style={{
                background: 'var(--gold)',
                color: '#0A0A0A',
                boxShadow: '0 8px 24px rgba(201,168,76,0.25)',
              }}
            >
              Join Telegram Channel →
            </a>
          </div>
        </div>

        {/* Expired Deal Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {deals.map((deal: any) => (
            <div
              key={deal._id.toString()}
              className="rounded-2xl overflow-hidden relative"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--sm-border)',
              }}
            >
              {/* Expired Overlay */}
              <div
                className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px]"
                style={{ background: 'rgba(10,10,10,0.6)' }}
              >
                <div
                  className="font-black text-3xl px-6 py-2 uppercase tracking-widest transform -rotate-12"
                  style={{
                    border: '4px solid rgba(239,68,68,0.8)',
                    color: 'rgba(239,68,68,0.8)',
                  }}
                >
                  Expired
                </div>
              </div>

              {/* Product Image */}
              <div className="h-48 bg-white p-4 flex items-center justify-center relative">
                <div className="absolute top-3 left-3 z-0">
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)' }}
                  >
                    Score: {deal.deal_score}/100
                  </span>
                </div>
                <Image
                  src={deal.image_url || '/placeholder.png'}
                  alt={deal.title}
                  fill
                  className="object-contain p-4"
                />
              </div>

              {/* Deal Info */}
              <div className="p-5 flex flex-col h-full">
                <div className="flex-grow">
                  <h3
                    className="font-medium line-clamp-2 mb-4"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {deal.title}
                  </h3>
                  <div className="flex items-end gap-3">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      ₹{(deal.discounted_price || 0).toLocaleString()}
                    </span>
                    <span
                      className="text-sm line-through mb-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ₹{(deal.original_price || 0).toLocaleString()}
                    </span>
                    <span
                      className="text-sm font-bold mb-1 ml-auto"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {deal.source_platform}
                    </span>
                  </div>
                </div>
                
                {/* Back in stock notification form */}
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--sm-border)' }}>
                  <BackInStockForm 
                    dealId={deal._id.toString()} 
                    dealTitle={deal.title} 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* WhatsApp Exit CTA */}
        <div className="mt-16 text-center max-w-2xl mx-auto px-4 pb-12">
          <p className="text-sm mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
            Don&apos;t let this happen again.
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
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

          <p className="text-[10px] mt-4 italic" style={{ color: 'var(--text-muted)' }}>
            Reply STOP anytime to opt out · No spam
          </p>
        </div>

      </main>
    </div>
  );
}
