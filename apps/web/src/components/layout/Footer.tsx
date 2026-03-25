"use client";

import Link from 'next/link';
import { Instagram, Twitter, Send, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-[#2A2A35] bg-[#0A0A0F] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-[#FF6B00] to-[#FF9900] flex items-center justify-center font-black text-black text-sm">
                SM
              </div>
              <span className="font-extrabold text-lg text-white">Shadow<span className="text-[#FF6B00]">Merchant</span></span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              India's #1 AI-powered deal aggregator. We find the best discounts across Amazon, Flipkart, Myntra & more — automatically.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a href="https://t.me/ShadowMerchantDeals" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#FF6B00] transition-colors">
                <Send className="w-5 h-5" />
              </a>
              <a href="https://twitter.com/ShadowMerchant" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#FF6B00] transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://instagram.com/ShadowMerchant" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#FF6B00] transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="mailto:deals@shadowmerchant.in" className="text-gray-500 hover:text-[#FF6B00] transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Deals */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Deals</h4>
            <ul className="space-y-3">
              {[
                { label: 'Top Deals', href: '/deals' },
                { label: 'Flash Sales', href: '/deals?type=flash' },
                { label: 'Electronics', href: '/category/electronics' },
                { label: 'Fashion', href: '/category/fashion' },
                { label: 'Beauty', href: '/category/beauty' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-500 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Stores */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Stores</h4>
            <ul className="space-y-3">
              {[
                { label: 'Amazon India', href: '/store/amazon' },
                { label: 'Flipkart', href: '/store/flipkart' },
                { label: 'Myntra', href: '/store/myntra' },
                { label: 'Meesho', href: '/store/meesho' },
                { label: 'Nykaa', href: '/store/nykaa' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-500 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-3">
              {[
                { label: 'Pro Membership', href: '/pro' },
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Deal Alerts', href: '/alerts' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-500 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar + Affiliate Disclosure */}
        <div className="border-t border-[#2A2A35] pt-8 space-y-4">
          <p className="text-gray-600 text-xs leading-relaxed max-w-3xl">
            <strong className="text-gray-500">Affiliate Disclosure:</strong> ShadowMerchant participates in the Amazon Associates Program and other affiliate programs. We may earn a small commission when you click our links and make a purchase, at no additional cost to you. Prices and deals are sourced automatically and may change without notice.
          </p>
          <p className="text-gray-700 text-xs">
            © {new Date().getFullYear()} ShadowMerchant. All rights reserved. Made with ❤️ for Indian shoppers.
          </p>
        </div>
      </div>
    </footer>
  );
}
