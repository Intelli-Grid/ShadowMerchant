import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  clerk_id: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: String,
  subscription_tier: { type: String, enum: ['free', 'pro'], default: 'free' },
  subscription_id: String,
  subscription_expires_at: Date,
  wishlist: [{ type: String }], // deal_ids
  alert_preferences: {
    categories: [String],
    min_discount: { type: Number, default: 30 },
    platforms: [String],
    channels: [String]
  },
  notification_channels: {
    email: { type: Boolean, default: true },
    whatsapp: String,
    push_token: String
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models.User || mongoose.model('User', UserSchema);
