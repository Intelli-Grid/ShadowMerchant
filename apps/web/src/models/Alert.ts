import mongoose, { Schema } from 'mongoose';

const AlertSchema = new Schema({
  user_id: { type: String, required: true },
  type: { type: String, enum: ['category', 'brand', 'price_drop', 'keyword'], required: true },
  criteria: {
    category: String,
    brand: String,
    keyword: String,
    max_price: Number,
    min_discount: { type: Number, default: 30 }
  },
  is_active: { type: Boolean, default: true },
  last_triggered_at: Date
}, { timestamps: { createdAt: 'created_at' } });

AlertSchema.index({ user_id: 1, is_active: 1 });

export default mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
