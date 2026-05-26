import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',

  // Capture 10% of sessions for performance monitoring — adjust up if needed
  tracesSampleRate: 0.1,

  // Replay 5% of sessions, 100% when an error occurs
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],
})
