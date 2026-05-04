import type { Metadata } from 'next';
import { SubmitDealForm } from './_components/SubmitDealForm';

export const metadata: Metadata = {
  title: 'Submit a Deal | ShadowMerchant',
  description:
    'Found a great deal? Submit it to ShadowMerchant. We score all submissions — if it clears 70/100, it goes live for the community.',
  alternates: { canonical: '/submit-deal' },
};

export default function SubmitDealPage() {
  return (
    <main className="flex-1 w-full">
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">

        {/* Header */}
        <div className="mb-10 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-5"
            style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}
          >
            🤝 Community Deals
          </div>
          <h1
            className="text-3xl sm:text-4xl font-black mb-3"
            style={{ fontFamily: 'var(--font-display)', color: 'white' }}
          >
            You Found It. Share It.
          </h1>
          <p className="text-base leading-relaxed max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Paste a product URL from Amazon, Flipkart, Myntra, Meesho, or Nykaa.
            We score it with our algorithm — if it clears <strong className="text-white">70/100</strong>, it goes live for the entire community.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { step: '1', label: 'Paste the URL', desc: 'Any product link from supported platforms' },
            { step: '2', label: 'We Score It', desc: 'Our algorithm checks price history & discount depth' },
            { step: '3', label: 'Goes Live', desc: 'Deals scoring 70+ are published for the community' },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-2xl p-4 text-center border"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black mx-auto mb-2"
                style={{ background: 'var(--sm-accent-dim)', color: 'var(--sm-accent)' }}
              >
                {s.step}
              </div>
              <p className="text-xs font-bold text-white mb-1">{s.label}</p>
              <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <SubmitDealForm />

        {/* Fine print */}
        <p className="text-[11px] text-center mt-8 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Max 5 submissions per day. We review all submissions — spammy or invalid URLs are removed without notice.
          Approved submissions earn community recognition on your profile.
        </p>
      </div>
    </main>
  );
}
