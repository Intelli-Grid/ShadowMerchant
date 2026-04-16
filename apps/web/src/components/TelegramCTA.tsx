'use client';

// ─── ShadowMerchant Telegram CTA Banner ──────────────────────────────────────
// Clicking the CTA takes visitors to the Telegram channel's "JOIN" prompt.
// - Mobile  → tg:// deep link opens the Telegram app directly, showing the
//             JOIN confirmation screen before the channel feed (zero browser hop).
// - Desktop → t.me URL opens the Telegram Web join page with the same prompt.

import { Send } from 'lucide-react';

const TG_USERNAME = 'ShadowMerchantDeals';

export function TelegramCTA() {
  /**
   * Navigate to the Telegram channel's native JOIN prompt.
   * On mobile the Telegram app opens directly via the tg:// scheme;
   * on desktop the standard t.me link shows the join prompt in browser.
   */
  const handleJoin = () => {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const target = isMobile
      ? `tg://resolve?domain=${TG_USERNAME}`
      : `https://t.me/${TG_USERNAME}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div
        className="relative flex flex-col sm:flex-row items-center justify-between gap-6 px-8 py-7 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0A1628 0%, #0D1F3C 100%)',
          border: '1px solid rgba(59,130,246,0.25)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Telegram blue glow */}
        <div
          className="absolute -top-16 -left-16 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none"
          style={{ background: '#229ED9' }}
        />

        {/* Left — icon + text */}
        <div className="flex items-center gap-4 relative z-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
            style={{ background: 'rgba(34,158,217,0.15)', border: '1px solid rgba(34,158,217,0.3)' }}
          >
            <Send className="w-5 h-5" style={{ color: '#229ED9' }} />
          </div>
          <div>
            <p className="font-bold text-white text-base">
              Get instant deal alerts on Telegram
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Join <strong style={{ color: '#229ED9' }}>@{TG_USERNAME}</strong> — flash sales posted the moment they go live
            </p>
          </div>
        </div>

        {/* CTA — routes to Telegram JOIN prompt, native app on mobile */}
        <button
          onClick={handleJoin}
          className="relative z-10 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold
                     flex-shrink-0 transition-all hover:scale-105 active:scale-95 whitespace-nowrap cursor-pointer"
          style={{ background: '#229ED9', color: 'white' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(34,158,217,0.4)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          <Send className="w-4 h-4" />
          Join Free →
        </button>
      </div>
    </section>
  );
}
