import mongoose, { Schema } from 'mongoose';

const PriceHistorySchema = new Schema({
  date: { type: Date, required: true },
  price: { type: Number, required: true }
}, { _id: false });

const DealSchema = new Schema({
  deal_id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,
  source_platform: {
    type: String,
    enum: ['amazon', 'flipkart', 'myntra', 'meesho', 'nykaa', 'croma', 'tatacliq'],
    required: true
  },
  original_price: { type: Number, required: true },
  discounted_price: { type: Number, required: true },
  discount_percent: { type: Number, required: true },
  affiliate_url: { type: String, required: true },
  image_url: String,
  category: String,
  sub_category: String,
  brand: String,
  rating: { type: Number, default: 0 },
  rating_count: { type: Number, default: 0 },
  deal_type: { type: String, enum: ['daily', 'flash', 'lightning', 'clearance'], default: 'daily' },
  deal_score: { type: Number, default: 0, min: 0, max: 100 },
  is_pro_exclusive: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  price_history: [PriceHistorySchema],
  published_at: Date,
  scraped_at: Date,
  expires_at: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Indexes
DealSchema.index({ source_platform: 1, is_active: 1 });
DealSchema.index({ category: 1, is_active: 1, deal_score: -1 });
DealSchema.index({ discount_percent: -1, is_active: 1 });
DealSchema.index({ is_pro_exclusive: 1, is_active: 1 });
DealSchema.index({ published_at: -1 });
DealSchema.index({ title: 'text', description: 'text' });

export default mongoose.models.Deal || mongoose.model('Deal', DealSchema);
