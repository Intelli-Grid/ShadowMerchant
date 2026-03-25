import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin'] });

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.className} min-h-screen bg-[#0A0A0F] text-[#F0F0F0] antialiased flex flex-col`}>
          <Navbar />
          {children}
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
