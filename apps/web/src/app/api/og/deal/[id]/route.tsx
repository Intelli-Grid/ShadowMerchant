import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let deal: any = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.shadowmerchant.online'}/api/deals/${id}`,
      { next: { revalidate: 900 } }
    );
    if (res.ok) deal = await res.json();
  } catch {}

  const title = deal?.title ?? 'Exclusive Deal on ShadowMerchant';
  const price = deal?.discounted_price
    ? `₹${Number(deal.discounted_price).toLocaleString('en-IN')}`
    : '';
  const originalPrice = deal?.original_price
    ? `₹${Number(deal.original_price).toLocaleString('en-IN')}`
    : '';
  const discount = deal?.discount_percent ? `${Math.round(deal.discount_percent)}% OFF` : '';
  const platform = deal?.source_platform
    ? deal.source_platform.charAt(0).toUpperCase() + deal.source_platform.slice(1)
    : '';

  const platformColors: Record<string, string> = {
    amazon: '#FF9900',
    flipkart: '#2874F0',
    myntra: '#FF3F6C',
    meesho: '#9B2D8E',
    nykaa: '#FC2779',
    nykaa_fashion: '#FC2779',
    default: '#C9A84C',
  };
  const accentColor = platformColors[deal?.source_platform ?? 'default'] ?? platformColors.default;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '1200px',
          height: '630px',
          background: '#0A0A0A',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: -200, left: -200,
          width: 600, height: 600,
          background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
          borderRadius: '50%',
        }} />

        {/* Top strip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '28px 48px 0',
        }}>
          <span style={{ color: '#C9A84C', fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
            ⚡ ShadowMerchant
          </span>
          {platform && (
            <span style={{
              background: accentColor, color: '#fff',
              padding: '6px 16px', borderRadius: 8,
              fontSize: 18, fontWeight: 700,
            }}>
              {platform}
            </span>
          )}
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flex: 1, padding: '32px 48px', gap: 40, alignItems: 'center' }}>
          {/* Image area */}
          {deal?.image_url && (
            <div style={{
              width: 280, height: 280, borderRadius: 20,
              background: '#fff', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              <img
                src={deal.image_url}
                alt={title}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 16 }}
              />
            </div>
          )}

          {/* Text content */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>
            {/* Title */}
            <span style={{
              color: '#FFFFFF', fontSize: 32, fontWeight: 700, lineHeight: 1.3,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {title.length > 80 ? title.slice(0, 80) + '…' : title}
            </span>

            {/* Price row */}
            {price && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ color: '#FFFFFF', fontSize: 48, fontWeight: 900 }}>{price}</span>
                {discount && (
                  <span style={{
                    background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                    padding: '6px 14px', borderRadius: 8,
                    fontSize: 22, fontWeight: 800,
                  }}>
                    {discount}
                  </span>
                )}
              </div>
            )}

            {/* MRP */}
            {originalPrice && (
              <span style={{ color: '#666', fontSize: 20, textDecoration: 'line-through' }}>
                M.R.P: {originalPrice}
              </span>
            )}

            {/* CTA */}
            <div style={{
              marginTop: 8, display: 'flex', alignItems: 'center',
              background: '#C9A84C', borderRadius: 12,
              padding: '12px 28px', width: 'fit-content',
            }}>
              <span style={{ color: '#0A0A0A', fontWeight: 800, fontSize: 20 }}>
                Get This Deal →
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '0 48px 24px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ color: '#444', fontSize: 16 }}>shadowmerchant.online</span>
          <span style={{ color: '#444', fontSize: 16 }}>Curated by ShadowMerchant team</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
