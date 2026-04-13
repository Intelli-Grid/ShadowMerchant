import mongoose, { Schema } from 'mongoose';

const ReferralSchema = new Schema({
  referrer_clerk_id: { type: String, required: true, index: true },
  referral_code:     { type: String, required: true, unique: true, uppercase: true },
  referred_users:    [{ type: String }],   // clerk_ids of users who signed up via this code
  total_referrals:   { type: Number, default: 0 },
  pro_months_earned: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ReferralSchema.index({ referral_code: 1 }, { unique: true });

export default mongoose.models.Referral || mongoose.model('Referral', ReferralSchema);
