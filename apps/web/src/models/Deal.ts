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
  
  // Price history (for chart)
  price_history: [PriceHistorySchema],
  
  // Analytics
  click_count: { type: Number, default: 0 },
  view_count:  { type: Number, default: 0 },

  // Lifecycle
  published_at: { type: Date },
  scraped_at:   { type: Date },
  expires_at:   { type: Date },

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

export default mongoose.models.Deal || mongoose.model('Deal', DealSchema);
