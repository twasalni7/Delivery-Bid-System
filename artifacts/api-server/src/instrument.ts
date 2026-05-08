import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env["SENTRY_DSN"],
  environment: process.env["NODE_ENV"] ?? "production",
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});
