import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withSentryConfig(nextConfig, {
  // Suppresses Sentry CLI output during build
  silent: true,

  // Upload source maps to Sentry so stack traces show original code
  // Requires SENTRY_AUTH_TOKEN in Vercel env (optional — errors still captured without it)
  widenClientFileUpload: true,

  // Hides Sentry debug logs in the browser console
  hideSourceMaps: true,

  // Reduces bundle size by tree-shaking unused Sentry features
  disableLogger: true,
})
