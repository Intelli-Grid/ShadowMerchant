import Razorpay from 'razorpay';

// Lazy-initialised — prevents build crash when env vars are missing
// (e.g. Vercel preview deployments, build-time static analysis).
let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables.');
    }
    _razorpay = new Razorpay({ key_id, key_secret });
  }
  return _razorpay;
}

// Backwards-compatible export — callers using `razorpay.xxx` get the lazy instance
// via a Proxy so existing call sites don't need to change to `getRazorpay().xxx`.
export const razorpay: Razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    return (getRazorpay() as any)[prop];
  },
});

export const PLAN_IDS = {
  PRO_MONTHLY: process.env.RAZORPAY_MONTHLY_PLAN_ID || '',
  PRO_ANNUAL: process.env.RAZORPAY_ANNUAL_PLAN_ID || '',
};
