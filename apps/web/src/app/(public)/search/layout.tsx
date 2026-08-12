import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Deals — Amazon, Flipkart, Myntra, Nykaa | ShadowMerchant',
  description: 'Search 500+ verified deals across Amazon, Flipkart, Myntra, Nykaa and more. Every result includes a Shadow Score so you can instantly tell if the price is actually good.',
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
