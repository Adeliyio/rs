'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LogoIcon } from '@/components/logo';

import { signInAction as signIn } from '@/lib/convex/auth-actions';
import { Button } from '@/components/ui/button';

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Authentication failed. Please try again.',
  confirmation_failed:
    'Email confirmation failed. The link may have expired — please try signing in or request a new link.',
};


export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const urlMessage = searchParams.get('message');

  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData): Promise<void> {
    setFormError(null);
    const result = await signIn(formData);
    // signIn redirects on success; if we reach here it returned an error
    if (result?.error) {
      setFormError(result.error);
    }
  }

  const errorMessage =
    formError ?? (urlError ? ERROR_MESSAGES[urlError] ?? 'Something went wrong.' : null);

  return (
    <div className="flex flex-col gap-8">
      {/* Brand */}
      <div className="flex flex-col items-center gap-4">
        <LogoIcon className="h-12 w-12" />
        <div className="text-center">
          <h1 className="text-[24px] font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Sign in to your Resolvaio account
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-card p-8 shadow-premium">
        {/* Success message (e.g. after registration) */}
        {urlMessage && !urlError && (
          <div className="mb-5 rounded-xl border border-primary/20 bg-accent px-4 py-3 text-[14px] text-accent-foreground">
            {urlMessage}
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
            {errorMessage}
          </div>
        )}

        {/* Email/Password Form */}
        <form action={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-[13px] font-medium leading-none"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-[14px] ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-[13px] font-medium leading-none"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[12px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-[14px] ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
            />
          </div>

          <Button type="submit" size="lg" className="w-full">
            Sign In
          </Button>
        </form>
      </div>

      {/* Footer links */}
      <p className="text-center text-[14px] text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>

      {/* Disclaimer */}
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
        Resolvaio is a writing and research assistance tool, not a law firm.
      </p>
    </div>
  );
}
