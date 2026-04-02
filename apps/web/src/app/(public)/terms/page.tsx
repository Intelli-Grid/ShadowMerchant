import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | ShadowMerchant',
  description: 'Terms of Service for ShadowMerchant — AI-powered deal aggregation platform.',
  robots: 'index, follow',
};

export default function TermsPage() {
  return (
    <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-black text-white mb-2">Terms of Service</h1>
      <p className="text-gray-500 mb-10 text-sm">Last updated: April 2, 2026</p>

      <div className="space-y-8 text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing and using ShadowMerchant (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
            If you do not agree, please do not use the Service. These terms apply to all visitors, registered users, and Pro subscribers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">2. About the Service</h2>
          <p>
            ShadowMerchant is an AI-powered deal aggregation platform that collects and ranks deals from
            third-party e-commerce platforms including Amazon India, Flipkart, Meesho, Myntra, Nykaa, and Croma.
            We are an independent service and are not affiliated with, endorsed by, or sponsored by any of these platforms.
          </p>
          <p className="mt-3">
            Deal information including prices, availability, and discounts is sourced automatically and may not always reflect
            the real-time state of the merchant&apos;s website. Always verify the current price before purchasing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">3. Affiliate Disclaimer</h2>
          <p>
            ShadowMerchant participates in affiliate marketing programmes including Amazon Associates and Admitad.
            When you click a &quot;Get Deal&quot; link and complete a purchase, we may earn a commission <strong className="text-white">at no additional cost to you</strong>.
            This commission helps fund the free tier of the service. Our AI deal scoring is not influenced by affiliate commission rates.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">4. Pro Subscription</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>Pro plans (Monthly ₹99/mo or Annual ₹799/yr) are processed via Razorpay and auto-renew unless cancelled.</li>
            <li>You may cancel your subscription at any time via your Dashboard. Access continues until the end of the current billing period.</li>
            <li>Refunds are not provided for partially used subscription periods, except where required by applicable law.</li>
            <li>We reserve the right to modify Pro plan pricing with 30 days&apos; notice to subscribers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">5. User Accounts</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>You must provide accurate information when creating an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You may not use the Service for any unlawful purpose or in violation of these Terms.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">6. Prohibited Uses</h2>
          <p>You may not:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>Scrape, crawl, or systematically harvest data from the Service</li>
            <li>Use automated bots or scripts to interact with the Service</li>
            <li>Attempt to reverse engineer or circumvent any security measures</li>
            <li>Use the Service in any way that could impair its performance or availability</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">7. Intellectual Property</h2>
          <p>
            The ShadowMerchant brand, logo, AI deal scoring algorithm, and all original content on this platform
            are the property of ShadowMerchant and are protected by applicable intellectual property laws.
            Deal data is sourced from public e-commerce listings and remains the property of the respective merchants.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">8. Disclaimer of Warranties</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee the accuracy,
            completeness, or timeliness of deal information. Prices and availability are subject to change without notice
            on the merchant&apos;s platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">9. Limitation of Liability</h2>
          <p>
            ShadowMerchant shall not be liable for any indirect, incidental, special, or consequential damages
            arising from your use of the Service or reliance on deal information displayed herein.
            Our total liability shall not exceed the amount paid by you for the Service in the past 3 months.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">10. Governing Law</h2>
          <p>
            These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction
            of the courts of India. If you have a dispute, please contact us first at{' '}
            <a href="mailto:support@shadowmerchant.online" className="underline" style={{ color: 'var(--gold)' }}>
              support@shadowmerchant.online
            </a>{' '}
            and we will try to resolve it amicably.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">11. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify registered users of significant changes via email.
            Continued use of the Service after changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">12. Contact</h2>
          <p>
            For questions about these Terms, contact us at{' '}
            <a href="mailto:support@shadowmerchant.online" className="underline" style={{ color: 'var(--gold)' }}>
              support@shadowmerchant.online
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
