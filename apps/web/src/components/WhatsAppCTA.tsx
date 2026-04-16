'use client';

// ─── ShadowMerchant WhatsApp CTA Banner ───────────────────────────────────────
// Homepage companion banner to TelegramCTA.tsx.
// Mirrors TelegramCTA's dark-card style with WhatsApp green palette.
// Shows two entry points: 1-on-1 business chat + channel join.

const WA_NUMBER = '919152952052';
const WA_CHANNEL = 'https://whatsapp.com/channel/0029Vb7dimp1XquQpiaSWQ1N';
const WA_TEXT = encodeURIComponent(
  "Hi! I found ShadowMerchant. Send me today's top deals 🔥"
);
const WA_CHAT_URL = `https://wa.me/${WA_NUMBER}?text=${WA_TEXT}`;

const WhatsAppIcon = ({ size = 20, color = '#25D366' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export function WhatsAppCTA() {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
      <div
        className="relative flex flex-col sm:flex-row items-center justify-between gap-5 px-6 sm:px-8 py-6 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #071A0B 0%, #0A2210 100%)',
          border: '1px solid rgba(37,211,102,0.22)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Green glow orb — mirrors TelegramCTA's blue orb */}
        <div
          className="absolute -top-16 -left-16 w-48 h-48 rounded-full blur-[80px] opacity-25 pointer-events-none"
          style={{ background: '#25D366' }}
        />

        {/* Left — icon + text */}
        <div className="flex items-center gap-4 relative z-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(37,211,102,0.14)',
              border: '1px solid rgba(37,211,102,0.28)',
            }}
          >
            <WhatsAppIcon size={22} />
          </div>
          <div>
            <p className="font-bold text-white text-base">
              Get deals on WhatsApp
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Daily deal digests &amp; flash alerts — direct to your phone
            </p>
          </div>
        </div>

        {/* Right — dual CTAs */}
        <div className="relative z-10 flex items-center gap-3 flex-shrink-0">
          {/* Secondary — Channel join */}
          <a
            href={WA_CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold
                       transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            style={{
              background: 'rgba(37,211,102,0.12)',
              border: '1px solid rgba(37,211,102,0.28)',
              color: '#25D366',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.12)';
            }}
          >
            📢 Join Channel
          </a>

          {/* Primary — 1-on-1 chat */}
          <a
            href={WA_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
                       transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            style={{ background: '#25D366', color: 'white' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 0 20px rgba(37,211,102,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <WhatsAppIcon size={15} color="white" />
            Join Now →
          </a>
        </div>

        {/* Mobile — Channel link row */}
        <div className="sm:hidden relative z-10 flex items-center gap-2 w-full justify-center">
          <a
            href={WA_CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold transition-colors"
            style={{ color: 'rgba(37,211,102,0.75)' }}
          >
            📢 or join our WhatsApp Channel
          </a>
        </div>

        {/* DPDP compliance */}
        <p
          className="absolute bottom-1.5 right-4 text-[9px] italic hidden sm:block"
          style={{ color: 'rgba(255,255,255,0.2)' }}
        >
          You initiate contact · Reply STOP to opt out
        </p>
      </div>
    </section>
  );
}
