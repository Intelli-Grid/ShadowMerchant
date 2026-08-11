import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SplashScreen } from '@/components/SplashScreen';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { PostHogProvider } from '@/components/PostHogProvider';
import { WishlistProvider } from '@/context/WishlistContext';
import { ReferralTracker } from '@/components/ReferralTracker';
import { ReferralApplier } from '@/components/ReferralApplier';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { Suspense } from 'react';

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online'),
  title: 'ShadowMerchant | India\'s Best Deal Discovery Platform',
  description: 'Our team hunts and verifies the best deals from Amazon, Flipkart, Myntra & more — scored, ranked and updated constantly. Save big, shop smart.',
  icons: {
    icon: '/favicon.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'ShadowMerchant — Best Deals Curated for India',
    description: 'Discover top-scored deals from Amazon, Flipkart, Myntra & more — verified and updated by the ShadowMerchant team.',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'ShadowMerchant — Best Deals in India' }],
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShadowMerchant',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShadowMerchant — Best Deals Curated for India',
    description: 'Discover top-scored deals from Amazon, Flipkart, Myntra & more — verified and updated by the ShadowMerchant team.',
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
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <PostHogProvider>
            <WishlistProvider>
              {/* Captures ?ref= param on any page for referral attribution */}
              <Suspense fallback={null}>
                <ReferralTracker />
              </Suspense>
              {/* Applies stored referral code once user logs in */}
              <ReferralApplier />
              {/* First-visit splash screen */}
              <SplashScreen />
              {/* Atmospheric gold glow behind everything */}
              <div className="hero-atmosphere" aria-hidden="true" />
              <Navbar />
              <main className="flex-1 relative z-10 pb-20 md:pb-0">
                {children}
              </main>
              <Footer />
              {/* WhatsApp floating action button — shown on all pages */}
              <WhatsAppFloat />
              {/* Mobile bottom navigation — shown only on small screens */}
              <MobileBottomNav />
            </WishlistProvider>
          </PostHogProvider>
          {/* Razorpay checkout.js — loaded once globally to prevent race conditions */}
          <Script
            src="https://checkout.razorpay.com/v1/checkout.js"
            strategy="lazyOnload"
            id="razorpay-checkout-js"
          />
          {/* OneSignal v16 SDK — push notification delivery */}
          <Script
            src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
            defer
            id="onesignal-sdk"
          />
          <Script id="onesignal-init" strategy="afterInteractive">
            {`
              window.OneSignalDeferred = window.OneSignalDeferred || [];
              OneSignalDeferred.push(async function(OneSignal) {
                await OneSignal.init({
                  appId: "${process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '946ded21-cea2-42c3-9d6d-e20f20217452'}",
                  promptOptions: {
                    slidedown: {
                      enabled: true,
                      actionMessage: "Get instant alerts for hot deals before they sell out!",
                      acceptButtonText: "Yes, notify me!",
                      cancelButtonText: "No thanks",
                      delay: { timeDelay: 15, pageViews: 2 }
                    }
                  },
                  welcomeNotification: {
                    title: "ShadowMerchant 🛒",
                    message: "You're in! We'll ping you when a deal is genuinely worth it."
                  },
                  notifyButton: { enable: false }
                });
              });
            `}
          </Script>
        </body>
      </html>
    </ClerkProvider>
  );
}
