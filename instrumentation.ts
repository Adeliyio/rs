/**
 * Next.js instrumentation hook — runs once when the server process boots.
 *
 * This is what actually initializes Sentry. Without it, `initSentry()` was dead
 * code and production had no error tracking (audit finding Rel-H1). `initSentry`
 * is a no-op when SENTRY_DSN is unset, so this is safe with or without Sentry
 * configured. Node-runtime only — Sentry's server SDK doesn't run on edge.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSentry } = await import('@/lib/sentry');
    initSentry();
  }
}
