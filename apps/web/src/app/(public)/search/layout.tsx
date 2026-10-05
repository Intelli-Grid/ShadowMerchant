import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Deals — Amazon, Myntra, Nykaa | ShadowMerchant',
  description: 'Search verified deals across Amazon, Myntra & Nykaa. Every result includes a Shadow Score so you can instantly tell if the price is actually good.',
  openGraph: {
    title: 'Search Deals | ShadowMerchant',
    description: 'Find deals from India\'s top platforms with verified Shadow Scores.',
    url: 'https://www.shadowmerchant.online/search',
    type: 'website',
  },
  alternates: { canonical: 'https://www.shadowmerchant.online/search' },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
