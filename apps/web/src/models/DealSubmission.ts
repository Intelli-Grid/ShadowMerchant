import mongoose, { Schema } from 'mongoose';

const DealSubmissionSchema = new Schema({
  user_id: { type: String, required: true },   // Clerk user ID

  // Submitted by user
  url:            { type: String, required: true },
  reported_price: { type: Number },             // optional — user may not know
  notes:          { type: String, maxlength: 500 },

  // Auto-fetched metadata (populated by API after submission)
  fetched_title:  { type: String },
  fetched_image:  { type: String },
  auto_score:     { type: Number },             // tentative score if computable

  // Review lifecycle
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'duplicate'],
    default: 'pending',
  },
  reviewed_at: { type: Date },
  deal_id:     { type: String },                // set when approved → linked to a Deal document

}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

DealSubmissionSchema.index({ user_id: 1, status: 1 });
DealSubmissionSchema.index({ status: 1, created_at: -1 });   // for admin /pending query

export default mongoose.models.DealSubmission ||
  mongoose.model('DealSubmission', DealSubmissionSchema);
