import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | ShadowMerchant',
  description: 'Terms of Service for ShadowMerchant',
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-24 max-w-4xl min-h-screen">
      <h1 className="text-4xl font-bold mb-8 text-[var(--text-primary)]">Terms of Service</h1>
      <div className="prose prose-invert max-w-none text-[var(--text-secondary)]">
        <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
        <p className="mb-4">
          Please read these Terms of Service carefully before using our website.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-[var(--text-primary)]">1. Acceptance of Terms</h2>
        <p className="mb-4">
          By accessing and using this website, you accept and agree to be bound by the terms and
          provision of this agreement.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-[var(--text-primary)]">2. Content</h2>
        <p className="mb-4">
          Our deals and data are aggregated by our proprietary web scraping engine. 
          We are not responsible for price changes, out of stock updates on third-party sites.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-[var(--text-primary)]">3. Affiliate Disclaimer</h2>
        <p className="mb-4">
          ShadowMerchant participates in affiliate marketing programs, and may get paid commissions on 
          purchases made through our links.
        </p>
        {/* Placeholder for more comprehensive terms */}
        <p className="mt-12 text-sm opacity-50">
          This is a placeholder for the full Terms of Service.
        </p>
      </div>
    </div>
  );
}
