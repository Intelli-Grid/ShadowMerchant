import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'ShadowMerchant | The #1 Top-Deals Aggregator for Indian Shoppers',
  description: 'Stop hunting for deals across 10 apps. ShadowMerchant finds every top deal in India and shows it to you in one place.',
  icons: {
    icon: '/favicon.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'ShadowMerchant — Best Deals in India',
    description: 'AI-powered deal aggregation from Amazon, Flipkart, Myntra & more.',
    images: ['/logo.png'],
    type: 'website',
    locale: 'en_IN',
  },
  other: {
    'verify-admitad': 'ccea15b445',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
        <body className="min-h-screen antialiased flex flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
          {/* Atmospheric glow behind everything */}
          <div className="hero-atmosphere" aria-hidden="true" />
          <Navbar />
          <main className="flex-1 relative z-10">
            {children}
          </main>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
