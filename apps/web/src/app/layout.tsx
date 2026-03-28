import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SplashScreen } from '@/components/SplashScreen';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

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
  title: 'ShadowMerchant | #1 AI Deal Aggregator for Indian Shoppers',
  description: 'Discover the best deals from Amazon, Flipkart, Myntra & more — automatically scored and ranked by ShadowMerchant AI. Save big, shop smart.',
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
    siteName: 'ShadowMerchant',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShadowMerchant — Best Deals in India',
    description: 'AI-powered deal aggregation from Amazon, Flipkart, Myntra & more.',
    images: ['/logo.png'],
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
        <body
          className="min-h-screen antialiased flex flex-col"
          style={{
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            /* Extra bottom padding so content isn't covered by mobile bottom nav */
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* First-visit splash screen */}
          <SplashScreen />
          {/* Atmospheric gold glow behind everything */}
          <div className="hero-atmosphere" aria-hidden="true" />
          <Navbar />
          <main className="flex-1 relative z-10 pb-20 md:pb-0">
            {children}
          </main>
          <Footer />
          {/* Mobile bottom navigation — shown only on small screens */}
          <MobileBottomNav />
        </body>
      </html>
    </ClerkProvider>
  );
}
