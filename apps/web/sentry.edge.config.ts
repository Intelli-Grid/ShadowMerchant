import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Edge runtime — keep trace rate minimal (edge functions are high-volume)
  tracesSampleRate: 0.05,

  environment: process.env.NODE_ENV,

  // Only active in production — never in local dev
  enabled: process.env.NODE_ENV === "production",
});
