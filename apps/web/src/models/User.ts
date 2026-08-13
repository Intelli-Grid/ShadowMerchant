import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  clerk_id: { type: String, required: true, unique: true },
  email: { type: String },  // Set by Clerk webhook; not required since other routes may create the user first
  name: String,
  subscription_tier: { type: String, enum: ['free', 'pro'], default: 'free' },
  subscription_id: String,
  // NEW: track which plan the user is on — needed for accurate MRR (monthly vs annual)
  subscription_plan: { type: String, enum: ['monthly', 'annual', null], default: null },
  subscription_status: { type: String, enum: ['created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired', 'paused'] },
  subscription_expires_at: Date,
  subscription_cancel_scheduled: { type: Boolean, default: false },
  wishlist: {
    type: [{ type: String }], // MongoDB ObjectId hex strings (deal._id)
    validate: {
      validator: (arr: string[]) => arr.length <= 200,
      message: 'Wishlist cannot exceed 200 items',
    },
  },
  alert_preferences: {
    categories: [String],
    min_discount: { type: Number, default: 30 },
    platforms: [String],
    channels: [String]
  },
  notification_channels: {
    email:      { type: Boolean, default: true },
    whatsapp:   String,
    push_token: String,
    telegram:   String,   // Telegram chat_id — linked via bot /start deep link
  },
  // Referral system — code is generated on first request, queried by code lookup
  referral_code:  { type: String, sparse: true },
  referral_count: { type: Number, default: 0 },
  referred_by:    { type: String },   // referral_code of the person who referred this user
  // Attribution — which channel drove this sign-up (from UTM params at sign-up)
  signup_source:  { type: String },   // e.g. 'instagram', 'telegram', 'reddit', 'direct'
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// ─── Indexes ─────────────────────────────────────────────────────────────────
// clerk_id already unique above

// Cron sweep: downgrade expired Pro users (runs every 4h)
UserSchema.index({ subscription_tier: 1, subscription_expires_at: 1 });

// Revenue dashboard queries
UserSchema.index({ subscription_tier: 1, subscription_status: 1 });
UserSchema.index({ subscription_tier: 1, created_at: -1 });

// Churn risk queries (expires within 7 days)
UserSchema.index({ subscription_tier: 1, subscription_expires_at: 1, subscription_status: 1 });

// Referral lookup — must be fast, code is unique
UserSchema.index({ referral_code: 1 }, { sparse: true });

// Email lookup (Clerk webhook updates)
UserSchema.index({ email: 1 }, { sparse: true });

// Telegram chat_id lookup for the WhatsApp/Telegram notifier
UserSchema.index({ 'notification_channels.telegram': 1 }, { sparse: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);

