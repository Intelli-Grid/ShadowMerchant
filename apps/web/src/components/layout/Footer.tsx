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
                aria-label="Telegram"
              >
                <Send className="w-5 h-5" />
              </a>
              {/* WhatsApp Channel */}
              <a href="https://whatsapp.com/channel/0029Vb7dimp1XquQpiaSWQ1N" target="_blank" rel="noopener noreferrer" className="transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                aria-label="WhatsApp Channel"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <a href="https://twitter.com/ShadowMerchant" target="_blank" rel="noopener noreferrer" className="transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://instagram.com/ShadowMerchant" target="_blank" rel="noopener noreferrer" className="transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a href="mailto:deals@shadowmerchant.online" className="transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--gold)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
                aria-label="Email"
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
