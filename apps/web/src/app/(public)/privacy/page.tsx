import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | ShadowMerchant',
  description: 'Privacy Policy for ShadowMerchant — how we collect, use, and protect your personal data.',
  robots: 'index, follow',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-black text-white mb-2">Privacy Policy</h1>
      <p className="text-gray-500 mb-10 text-sm">Last updated: April 2, 2026</p>

      <div className="space-y-8 text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
          <p>When you use ShadowMerchant, we may collect:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>Account information (name, email) provided via Clerk authentication (Google / email sign-in)</li>
            <li>Usage data such as pages visited, deals clicked, and wishlist items saved</li>
            <li>Payment information processed securely via Razorpay — we do not store card or bank details</li>
            <li>Device type, browser, and approximate location (city-level) for analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>Provide and improve the ShadowMerchant deal discovery and recommendation service</li>
            <li>Process Pro subscription payments via Razorpay</li>
            <li>Send deal alerts and price-drop notifications (Pro users only, based on your alert settings)</li>
            <li>Analyse anonymised usage patterns to improve AI deal scoring</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">3. Third-Party Services</h2>
          <p>We share data only with the following processors:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li><strong className="text-white">Clerk</strong> — Authentication and user account management</li>
            <li><strong className="text-white">Razorpay</strong> — Payment processing for Pro subscriptions</li>
            <li><strong className="text-white">Algolia</strong> — Deal search (anonymised query data only)</li>
            <li><strong className="text-white">PostHog</strong> — Product analytics (anonymised, no PII)</li>
            <li><strong className="text-white">MongoDB Atlas</strong> — User profile and subscription data storage</li>
          </ul>
          <p className="mt-3">We do not sell your personal data to any third party.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">4. Affiliate Disclosure</h2>
          <p>
            ShadowMerchant participates in affiliate programmes including Amazon Associates, Admitad, and others.
            When you click a deal link and make a purchase, we may earn a commission at <strong className="text-white">no additional cost to you</strong>.
            All prices shown are the prices on the merchant's site. Affiliate tracking uses URL parameters only — no personal data is passed to partner platforms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">5. Cookies</h2>
          <p>
            We use session cookies required for authentication and optional analytics cookies (PostHog).
            You can disable non-essential cookies in your browser settings without affecting core functionality.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">6. Your Rights (DPDP Act 2023)</h2>
          <p>In compliance with India's Digital Personal Data Protection Act, 2023, you have the right to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate personal data</li>
            <li>Request erasure of your personal data</li>
            <li>Withdraw consent for optional data processing at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">7. Data Retention</h2>
          <p>
            Account data is retained for as long as your account is active. Subscription payment records are retained for 7 years as required by Indian GST law.
            To delete your account, email{' '}
            <a href="mailto:privacy@shadowmerchant.online" className="underline" style={{ color: 'var(--gold)' }}>
              privacy@shadowmerchant.online
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
          <p>
            For any privacy-related queries, please contact our Data Protection team at{' '}
            <a href="mailto:privacy@shadowmerchant.online" className="underline" style={{ color: 'var(--gold)' }}>
              privacy@shadowmerchant.online
            </a>.
          </p>
        </section>
      </div>
    </main>
  );
}
