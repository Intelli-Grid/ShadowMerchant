import mongoose, { Schema } from 'mongoose';

const AlertSchema = new Schema({
  user_id: { type: String, required: true },
  type: {
    type: String,
    enum: ['category', 'brand', 'price_drop', 'keyword', 'target_price'],
    required: true,
  },
  criteria: {
    // keyword / brand / category / price_drop fields
    category:     String,
    brand:        String,
    keyword:      String,
    max_price:    Number,
    min_discount: { type: Number, default: 30 },

    // target_price fields — tied to a specific deal, not a search criteria
    deal_id:       String,   // Deal._id as string
    product_title: String,   // Denormalized for dashboard display
    platform:      String,   // Denormalized for display
    target_price:  Number,   // User's desired price threshold (₹)
    current_price: Number,   // Price at time of alert creation (for context)
  },
  is_active:        { type: Boolean, default: true },
  triggered_at:     { type: Date },          // set when alert fires
  last_triggered_at: Date,
}, { timestamps: { createdAt: 'created_at' } });

AlertSchema.index({ user_id: 1, is_active: 1 });
AlertSchema.index({ type: 1, is_active: 1 });                         // for scheduler batch queries
AlertSchema.index({ 'criteria.deal_id': 1, user_id: 1 }, { sparse: true }); // for "has user already set alert?" check

export default mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
