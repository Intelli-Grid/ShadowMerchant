import Razorpay from 'razorpay';

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const PLAN_IDS = {
  PRO_MONTHLY: process.env.RAZORPAY_PLAN_MONTHLY!,
  PRO_ANNUAL: process.env.RAZORPAY_PLAN_ANNUAL!,
};
