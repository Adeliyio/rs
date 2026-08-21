'use client';

import { useState } from 'react';

import { useResolvaioAuth } from '@/lib/convex/use-auth';

/**
 * "Continue with Google" button (A4). Calls the Convex Auth Google provider via
 * useResolvaioAuth().google(). Requires AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET to be
 * set on the Convex deployment — otherwise the redirect fails and we surface a
 * friendly error rather than a blank page.
 */
export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  const auth = useResolvaioAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    const result = await auth.google();
    // On success the browser is redirected to Google; only errors return here.
    if (result?.error) {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[12px] text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {error && (
        <p className="text-[13px] text-destructive" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-input bg-background px-4 text-[14px] font-medium ring-offset-background transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={label}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
          />
        </svg>
        {busy ? 'Redirecting…' : label}
      </button>
    </div>
  );
}
