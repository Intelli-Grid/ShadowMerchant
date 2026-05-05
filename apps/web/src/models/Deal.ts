import mongoose, { Schema } from 'mongoose';

const PriceHistorySchema = new Schema({
  date: { type: Date, required: true },
  price: { type: Number, required: true }
}, { _id: false });

const ScoreBreakdownSchema = new Schema({
  discount_score:   { type: Number, default: 0 },
  price_drop_score: { type: Number, default: 0 },
  popularity_score: { type: Number, default: 0 },
  rating_score:     { type: Number, default: 0 },
  freshness_score:  { type: Number, default: 0 },
}, { _id: false });

const AlternateLinkSchema = new Schema({
  source: { type: String, required: true },
  url:    { type: String, required: true },
  price:  { type: Number, required: true },
}, { _id: false });

const DealSchema = new Schema({
  deal_id: { type: String, required: true, unique: true },
  
  // Product Identity
  title:            { type: String, required: true },
  title_normalized: { type: String },         // lowercase, stripped — for dedup
  description:      { type: String },
  brand:            { type: String },
  category:         { type: String },
  sub_category:     { type: String },

  // Source
  source_platform: {
    type: String,
    enum: ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa', 'croma', 'tatacliq'],
    required: true,
  },
  
  // Pricing
  original_price:   { type: Number, required: true },
  discounted_price: { type: Number, required: true },
  discount_percent: { type: Number, required: true },
  affiliate_url:    { type: String, required: true },
  
  // Alternate sources (dedup merge result)
  alternate_links: [AlternateLinkSchema],
  
  // Media
  image_url: { type: String },

  // Quality signals
  rating:       { type: Number, default: 0 },
  rating_count: { type: Number, default: 0 },
  
  // Deal type
  deal_type:    { type: String, enum: ['daily', 'flash', 'lightning', 'clearance'], default: 'daily' },
  is_flash:     { type: Boolean, default: false },
  flash_ends_at:{ type: Date },

  // Scoring (v2 — 5-component weighted formula)
  deal_score:      { type: Number, default: 0, min: 0, max: 100 },
  score_breakdown: { type: ScoreBreakdownSchema, default: () => ({}) },
  
  // Status flags
  is_pro_exclusive: { type: Boolean, default: false },
  is_active:        { type: Boolean, default: true },
  is_trending:      { type: Boolean, default: false },  // Top 8 across all categories
  is_stale:         { type: Boolean, default: false },  // BUG-13: written by scheduler.py staleness check
  data_may_be_stale: { type: Boolean, default: false }, // set after 3 consecutive scraper failures for this platform

  // Algorithmic scoring
  trending_score:  { type: Number, default: 0 },        // BUG-13: written by scheduler.py trending algo
  
  // Price history (for chart)
  price_history: [PriceHistorySchema],
  
  // Analytics
  click_count: { type: Number, default: 0 },
  view_count:  { type: Number, default: 0 },

  // Community reactions (denormalised cache — kept in sync by reactions API)
  reactions_cache: {
    fire:    { type: Number, default: 0 },
    meh:     { type: Number, default: 0 },
    expired: { type: Number, default: 0 },
  },

  // Lifecycle
  published_at: { type: Date },
  scraped_at:   { type: Date },
  expires_at:   { type: Date },

  // UPGRADE-H: Bank-specific offer — populated by scraper when detected (e.g. "Extra 10% off with SBI card")
  bank_offer: { type: String, default: null },

  // UPGRADE-G: MRP Clarity — populated by deal_scorer.py using price_history
  mrp_verified: { type: String, enum: ['verified', 'shifted', 'unknown'], default: 'unknown' },
  mrp_note: { type: String },   // e.g. "Near 30-day low" or "Listed MRP ~40% above observed historical prices"

  // UPGRADE-J: Stock signal — independent of is_active (which only flips after 72h)
  is_available: { type: Boolean, default: true },

  // UPGRADE-I: Flash deal notification tracker — prevents duplicate Telegram posts
  telegram_notified: { type: Boolean, default: false },

}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// ─── Indexes ────────────────────────────────────────────────────────────────
DealSchema.index({ source_platform: 1, is_active: 1 });
DealSchema.index({ category: 1, is_active: 1, deal_score: -1 });
DealSchema.index({ discount_percent: -1, is_active: 1 });
DealSchema.index({ is_pro_exclusive: 1, is_active: 1 });
DealSchema.index({ is_trending: 1, is_active: 1 });          // NEW — fast trending query
DealSchema.index({ scraped_at: -1, is_active: 1 });          // NEW — day-wise archive
DealSchema.index({ published_at: -1 });
DealSchema.index({ title: 'text', description: 'text' });
DealSchema.index({ deal_score: -1, is_active: 1 });          // NEW — homepage score sort
DealSchema.index({ deal_type: 1, scraped_at: -1, is_active: 1 }); // UPGRADE-I — flash deal queries
// NEW-04: unique index on affiliate_url prevents duplicate deals from concurrent pipeline runs
DealSchema.index({ affiliate_url: 1 }, { unique: true, sparse: true });
// BUG-13: index on scraper-written fields for staleness and trending queries
DealSchema.index({ is_stale: 1, is_active: 1 });
DealSchema.index({ trending_score: -1, is_active: 1 });
// HEALTH: index for fast platform-scoped stale flagging from scheduler
DealSchema.index({ data_may_be_stale: 1, source_platform: 1 });
// COMMUNITY: index for fire-count sort on trending listing
DealSchema.index({ 'reactions_cache.fire': -1, is_active: 1 });

export default mongoose.models.Deal || mongoose.model('Deal', DealSchema);
