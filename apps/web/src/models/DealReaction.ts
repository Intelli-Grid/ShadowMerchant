import mongoose, { Schema, Document, models } from 'mongoose';

export interface IDealReaction extends Document {
  deal_id: string;
  user_id: string;          // Clerk user ID
  reaction: 'fire' | 'meh' | 'expired';
  created_at: Date;
}

const DealReactionSchema = new Schema<IDealReaction>(
  {
    deal_id:   { type: String, required: true, index: true },
    user_id:   { type: String, required: true },
    reaction:  { type: String, enum: ['fire', 'meh', 'expired'], required: true },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'deal_reactions' }
);

// One reaction per user per deal (upsert-replace pattern)
DealReactionSchema.index({ deal_id: 1, user_id: 1 }, { unique: true });

// Fast aggregation: count reactions per deal per type
DealReactionSchema.index({ deal_id: 1, reaction: 1 });

const DealReaction =
  models.DealReaction || mongoose.model<IDealReaction>('DealReaction', DealReactionSchema);

export default DealReaction;
