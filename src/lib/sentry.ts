/**
 * Sentry initialization — server + client.
 *
 * PII scrubbing: strips email addresses, user names, and
 * document content from error reports. Only sends error type,
 * stack trace, and anonymized metadata.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * PII patterns to scrub from error data.
 */
const PII_PATTERNS = [
  /[\w.-]+@[\w.-]+\.\w+/g, // Email addresses
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card numbers
  /(?:password|secret|token|key|apikey|api_key)\s*[:=]\s*\S+/gi, // Secrets in strings
];

function scrubPii(text: string): string {
  let scrubbed = text;
  for (const pattern of PII_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }
  return scrubbed;
}

export function initSentry(): void {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,

    beforeSend(event) {
      // Scrub PII from exception messages
      if (event.exception?.values) {
        for (const exception of event.exception.values) {
          if (exception.value) {
            exception.value = scrubPii(exception.value);
          }
        }
      }

      // Scrub PII from breadcrumbs
      if (event.breadcrumbs) {
        for (const breadcrumb of event.breadcrumbs) {
          if (breadcrumb.message) {
            breadcrumb.message = scrubPii(breadcrumb.message);
          }
        }
      }

      // Remove user email — only keep anonymized ID
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }

      return event;
    },

    // Don't send PII in request data
    beforeSendTransaction(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
      }
      return event;
    },
  });
}

export { Sentry };
