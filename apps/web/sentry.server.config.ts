import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  environment: process.env.NODE_ENV,

  // Only active in production — never in local dev
  enabled: process.env.NODE_ENV === "production",
});
