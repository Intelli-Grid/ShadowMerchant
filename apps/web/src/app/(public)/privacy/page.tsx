import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | ShadowMerchant',
  description: 'Privacy Policy for ShadowMerchant',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-24 max-w-4xl min-h-screen">
      <h1 className="text-4xl font-bold mb-8 text-[var(--text-primary)]">Privacy Policy</h1>
      <div className="prose prose-invert max-w-none text-[var(--text-secondary)]">
        <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
        <p className="mb-4">
          Welcome to ShadowMerchant. We respect your privacy and are committed to protecting your personal data.
          This privacy policy will inform you as to how we look after your personal data when you visit our website.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-[var(--text-primary)]">Information We Collect</h2>
        <p className="mb-4">
          We collect and process various types of information, including information you provide to us directly
          and information we collect automatically when you use our services.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4 text-[var(--text-primary)]">How We Use Your Information</h2>
        <p className="mb-4">
          We use your information to provide, maintain, and improve our services, as well as to communicate with you.
        </p>
        {/* Placeholder for more comprehensive privacy policy */}
        <p className="mt-12 text-sm opacity-50">
          This is a placeholder for the full privacy policy.
        </p>
      </div>
    </div>
  );
}
