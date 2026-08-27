'use client';

/**
 * Cookie consent banner — GDPR compliance.
 *
 * Note: Plausible analytics is cookie-free and doesn't require
 * consent. This banner is for Convex Auth session cookies
 * (strictly necessary) and any future tracking cookies.
 *
 * Since we only use strictly necessary cookies, the banner is
 * informational rather than opt-in/opt-out.
 */

import { useState, useEffect } from 'react';

const CONSENT_KEY = 'resolvaio_cookie_consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl border border-border bg-white p-5 shadow-premium-lg">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        We use strictly necessary cookies for authentication. No tracking cookies.{' '}
        <a href="/about" className="underline transition-colors hover:text-foreground">
          Learn more
        </a>
      </p>
      <button
        onClick={handleAccept}
        className="mt-3 w-full rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-foreground/90 active:scale-[0.98]"
      >
        Got it
      </button>
    </div>
  );
}
