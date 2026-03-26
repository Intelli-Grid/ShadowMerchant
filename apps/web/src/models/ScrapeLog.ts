import mongoose, { Schema } from 'mongoose';

const ScrapeResultSchema = new Schema({
  source:           { type: String, required: true },   // "amazon", "flipkart", etc.
  category:         { type: String, required: true },   // "electronics", "fashion", etc.
  deals_found:      { type: Number, default: 0 },
  deals_inserted:   { type: Number, default: 0 },
  deals_updated:    { type: Number, default: 0 },
  deals_duplicated: { type: Number, default: 0 },
  deals_skipped:    { type: Number, default: 0 },
  errors_count:     { type: Number, default: 0 },
  duration_ms:      { type: Number, default: 0 },
}, { _id: false });

const ScrapeLogSchema = new Schema({
  run_id:       { type: String, required: true, unique: true },  // "run_20260326_0600"
  started_at:   { type: Date, required: true },
  completed_at: { type: Date },
  status:       {
    type: String,
    enum: ['running', 'success', 'partial', 'failed'],
    default: 'running',
  },

  scrapers_run: [String],  // e.g. ["amazon", "flipkart", "myntra"]
  results:      [ScrapeResultSchema],

  // Aggregate stats
  total_deals_found:    { type: Number, default: 0 },
  total_deals_inserted: { type: Number, default: 0 },
  total_deals_updated:  { type: Number, default: 0 },
  total_duplicates:     { type: Number, default: 0 },
  total_errors:         { type: Number, default: 0 },

  error_message: { type: String },  // top-level error if status = "failed"
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ScrapeLogSchema.index({ started_at: -1 });
ScrapeLogSchema.index({ status: 1 });

export default mongoose.models.ScrapeLog || mongoose.model('ScrapeLog', ScrapeLogSchema);
