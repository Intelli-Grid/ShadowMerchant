import Link from 'next/link';

export const metadata = {
  title: 'Deal Not Found | ShadowMerchant',
  description: 'This deal may have expired or been removed. Browse thousands of live deals on ShadowMerchant.',
};

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div
        className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6 mx-auto text-5xl"
        style={{ background: 'var(--gold-glow)', border: '1px solid var(--gold-border)' }}
      >
        🔍
      </div>

      <h1
        className="text-4xl font-black mb-3"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        Deal Not Found
      </h1>

      <p className="text-gray-400 max-w-md mb-8 text-lg">
        This deal may have expired, sold out, or been removed by the retailer.
        Flash deals don&apos;t last long — but we have thousands of fresh ones.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/deals"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-base transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)',
            color: '#0a0a0f',
          }}
        >
          🔥 Browse Live Deals
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-base transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--sm-border)',
            color: 'var(--text-primary)',
          }}
        >
          ← Back to Home
        </Link>
      </div>

      <p className="text-gray-600 text-sm mt-10">
        Deals are refreshed every 6 hours from Amazon, Flipkart, Meesho &amp; more.
      </p>
    </main>
  );
}
