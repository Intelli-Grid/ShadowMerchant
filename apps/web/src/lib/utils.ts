import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateShadowScore(deal: any): number {
  const discount_pct = Number(deal.discount_percent || 0);
  const original_price = Number(deal.original_price || 0);
  const disc_price = Number(deal.discounted_price || 0);
  const rating = Number(deal.rating || 0);
  const rating_count = Number(deal.rating_count || 0);
  const scraped_at = deal.scraped_at || deal.created_at || new Date().toISOString();

  // 1. Discount score
  const s_discount = Math.min(discount_pct / 70.0, 1.0);

  // 2. Price drop score
  let s_price_drop = 0.0;
  if (original_price > 0 && disc_price > 0 && disc_price < original_price) {
    const absolute_drop = original_price - disc_price;
    s_price_drop = Math.min(absolute_drop / 3000.0, 1.0);
  }

  // 3. Popularity score
  const s_popularity = Math.min(rating_count / 10000.0, 1.0);

  // 4. Rating score
  const s_rating = Math.min(rating / 5.0, 1.0);

  // 5. Freshness score
  let s_freshness = 1.0;
  if (scraped_at) {
    const scraped_date = new Date(scraped_at);
    const now = new Date();
    const hours_old = (now.getTime() - scraped_date.getTime()) / (3600.0 * 1000);
    s_freshness = Math.max(0.0, 1.0 - hours_old / 168.0);
  }

  const weighted = (
    (s_discount * 0.35) +
    (s_price_drop * 0.20) +
    (s_popularity * 0.20) +
    (s_rating * 0.15) +
    (s_freshness * 0.10)
  );

  let final_score = Math.round(1.0 / (1.0 + Math.exp(-12.0 * (weighted - 0.72))) * 100);

  // Apply price history penalty
  if (deal.price_history && Array.isArray(deal.price_history)) {
    const now = new Date();
    const recent_prices: number[] = [];
    for (const entry of deal.price_history) {
      if (entry.price && entry.date) {
        const entry_date = new Date(entry.date);
        const days_old = (now.getTime() - entry_date.getTime()) / (1000 * 3600 * 24);
        if (days_old <= 7) {
          recent_prices.push(Number(entry.price));
        }
      }
    }
    
    if (recent_prices.length > 0) {
      const avg_7_day = recent_prices.reduce((a, b) => a + b, 0) / recent_prices.length;
      if (disc_price > avg_7_day) {
        final_score -= 30;
      }
    }
  }

  return Math.max(0, Math.min(100, final_score));
}
