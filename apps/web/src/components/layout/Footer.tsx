"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Instagram, Twitter, Send, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer
      className="w-full mt-auto"
      style={{
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--sm-border)',
      }}
    >
      {/* Gold gradient divider line */}
      <div
        className="w-full h-px"
        style={{
          background: 'linear-gradient(to right, transparent, var(--gold-border), transparent)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="relative w-10 h-10 flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="ShadowMerchant"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-extrabold text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                <span className="text-white">Shadow</span>
                <span style={{ color: 'var(--gold)' }}>Merchant</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              India&apos;s #1 AI-powered deal aggregator. We find the best discounts across Amazon, Flipkart, Myntra &amp; more — automatically.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a href="https://t.me/ShadowMerchantDeals" target="_blank" rel="noopener noreferrer" className="transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
              >
                <Send className="w-5 h-5" />
              </a>
              <a href="https://twitter.com/ShadowMerchant" target="_blank" rel="noopener noreferrer" className="transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://instagram.com/ShadowMerchant" target="_blank" rel="noopener noreferrer" className="transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a href="mailto:deals@shadowmerchant.in" className="transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Deals */}
          <div>
            <h4
              className="font-bold text-sm uppercase tracking-wider mb-4"
              style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
            >
              Deals
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Top Deals', href: '/deals' },
                { label: 'Flash Sales', href: '/deals?type=flash' },
                { label: 'Electronics', href: '/category/electronics' },
                { label: 'Fashion', href: '/category/fashion' },
                { label: 'Beauty', href: '/category/beauty' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Stores */}
          <div>
            <h4
              className="font-bold text-sm uppercase tracking-wider mb-4"
              style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
            >
              Stores
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Amazon India', href: '/store/amazon' },
                { label: 'Flipkart', href: '/store/flipkart' },
                { label: 'Myntra', href: '/store/myntra' },
                { label: 'Meesho', href: '/store/meesho' },
                { label: 'Nykaa', href: '/store/nykaa' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4
              className="font-bold text-sm uppercase tracking-wider mb-4"
              style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
            >
              Company
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Pro Membership', href: '/pro' },
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Deal Alerts', href: '/alerts' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 space-y-4" style={{ borderTop: '1px solid var(--sm-border)' }}>
          <p className="text-xs leading-relaxed max-w-3xl" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Affiliate Disclosure:</strong>{' '}
            ShadowMerchant participates in the Amazon Associates Program and other affiliate programs. We may earn a small commission when you click our links and make a purchase, at no additional cost to you. Prices and deals are sourced automatically and may change without notice.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} ShadowMerchant. All rights reserved. Made with ❤️ for Indian shoppers.
          </p>
        </div>
      </div>
    </footer>
  );
}
