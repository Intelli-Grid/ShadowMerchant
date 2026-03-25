import Razorpay from 'razorpay';

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const PLAN_IDS = {
  PRO_MONTHLY: 'plan_MONTHLY_ID',  // Replace with real Razorpay plan IDs
  PRO_ANNUAL: 'plan_ANNUAL_ID',
};
