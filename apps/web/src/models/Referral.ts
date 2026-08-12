import mongoose, { Schema } from 'mongoose';

const ReferralSchema = new Schema({
  referrer_clerk_id: { type: String, required: true, index: true },
  referral_code:     { type: String, required: true, unique: true, uppercase: true },
  // Cap at 500 entries — total_referrals (Number) tracks the real count without document bloat.
  // Viral users with 500+ referrals have the count in total_referrals; only the first 500
  // referred clerk_ids are stored for display/deduplication purposes.
  referred_users:    {
    type: [String],
    validate: {
      validator: (arr: string[]) => arr.length <= 500,
      message: 'referred_users exceeds the 500-entry cap',
    },
    default: [],
  },
  total_referrals:   { type: Number, default: 0 },
  pro_months_earned: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ReferralSchema.index({ referral_code: 1 }, { unique: true });

export default mongoose.models.Referral || mongoose.model('Referral', ReferralSchema);
