import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How to Compare Laptop Configurations Without Mixing Variants | ShadowMerchant',
  description: 'Learn how to compare laptop prices accurately in India by matching exact CPU, GPU, RAM, and display specifications.',
  openGraph: {
    title: 'How to Compare Laptop Configurations Without Mixing Variants',
    description: 'Avoid price comparison traps caused by differing laptop GPU wattages, RAM channels, and display specs.',
    url: 'https://www.shadowmerchant.online/guides/laptop-variant-guide',
  },
  alternates: { canonical: 'https://www.shadowmerchant.online/guides/laptop-variant-guide' },
};

export default function LaptopVariantGuide() {
  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-10 sm:py-14">
      <Link href="/guides" className="text-xs font-semibold text-gold hover:underline mb-6 inline-block">
        ← Back to all guides
      </Link>

      <article className="prose prose-invert max-w-none">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold">Laptop Buyer Guide</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 mb-4 leading-tight">
          How to Compare Laptop Configurations Without Mixing Variants
        </h1>

        <p className="text-sm text-gray-400 mb-8">
          Published by ShadowMerchant Research · 5 min read · Updated August 2026
        </p>

        <p className="text-base text-gray-300 leading-relaxed mb-6">
          Comparing laptop prices online can be treacherous. Two laptops with the exact same chassis model name (e.g. <em>Lenovo LOQ 15</em> or <em>ASUS TUF F15</em>) can differ in price by ₹25,000 simply due to internal hardware variants.
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">1. GPU Generation & TGP (Total Graphics Power)</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          An RTX 3050 (4GB) laptop at ₹50,000 is not comparable to an RTX 4050 (6GB) laptop at ₹72,000. Even within the same GPU tier, TGP wattages matter — an 85W RTX 4050 significantly outperforms a 45W RTX 4050.
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">2. RAM Channels & SSD Gen</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          Always check whether 8GB RAM is single-channel or expandable, and verify if the SSD is PCIe Gen 3 or PCIe Gen 4. A 16GB DDR5 dual-channel configuration adds real financial value over a single 8GB DDR4 stick.
        </p>

        <h2 className="text-xl font-bold text-white mt-8 mb-3">3. Exact SKU Matching Standard</h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          At ShadowMerchant, we enforce strict exact-SKU matching. We only compare historical price curves for laptops with matching CPU, GPU, RAM, and SSD configurations.
        </p>
      </article>
    </main>
  );
}
