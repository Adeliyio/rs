'use client';

/**
 * Plausible analytics script — privacy-friendly, no cookies,
 * GDPR-compliant by default (no cookie consent needed for Plausible).
 *
 * Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN in .env.local to enable.
 *
 * Custom events tracked:
 * - case_created: user starts a new case
 * - diagnostic_completed: user finishes the diagnostic flow
 * - letter_generated: a demand letter is generated
 * - letter_sent: user marks a letter as sent
 * - outcome_reported: user reports a case outcome
 */

import Script from 'next/script';

/* ------------------------------------------------------------------ */
/*  Plausible script tag                                              */
/* ------------------------------------------------------------------ */

export function PlausibleAnalytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  if (!domain) return null;

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Custom event helpers                                              */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number> },
    ) => void;
  }
}

/**
 * Sends a custom event to Plausible. No-op if Plausible is not loaded.
 */
function trackEvent(
  name: string,
  props?: Record<string, string | number>,
): void {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(name, props ? { props } : undefined);
  }
}

export function trackCaseCreated(wedge: string, jurisdiction: string): void {
  trackEvent('case_created', { wedge, jurisdiction });
}

export function trackDiagnosticCompleted(wedge: string): void {
  trackEvent('diagnostic_completed', { wedge });
}

export function trackLetterGenerated(jurisdiction: string): void {
  trackEvent('letter_generated', { jurisdiction });
}

export function trackLetterSent(jurisdiction: string): void {
  trackEvent('letter_sent', { jurisdiction });
}

export function trackOutcomeReported(category: string): void {
  trackEvent('outcome_reported', { category });
}
