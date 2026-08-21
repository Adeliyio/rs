'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Shield } from 'lucide-react';

import {
  requestPasswordResetAction,
  confirmPasswordResetAction,
} from '@/lib/convex/auth-actions';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Once a code is requested we switch to the code + new-password step.
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState('');

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const result = await requestPasswordResetAction(formData);

    if ('error' in result) {
      setError(result.error);
    } else {
      setEmail((formData.get('email') as string) ?? '');
      setCodeSent(true);
      setSuccess(result.success);
    }

    setIsSubmitting(false);
  }

  async function handleReset(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    const result = await confirmPasswordResetAction(formData);
    // redirects to /login on success; only returns on error
    if (result?.error) setError(result.error);
    setIsSubmitting(false);
  }

  /* ---- Step 2: enter code + new password ---- */
  if (codeSent) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-[24px] font-semibold tracking-tight">Enter reset code</h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              If an account exists for {email || 'that email'}, we emailed an 8-digit code.
              Enter it with your new password.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-8 shadow-premium">
          {error && (
            <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
              {error}
            </div>
          )}
          <form action={handleReset} className="flex flex-col gap-5">
            <input type="hidden" name="email" value={email} />
            <div className="flex flex-col gap-2">
              <label htmlFor="code" className="text-[13px] font-medium leading-none">
                Reset code
              </label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="12345678"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-[14px] tracking-[0.3em] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-[13px] font-medium leading-none">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-[14px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting...' : 'Reset password'}
            </Button>
          </form>
        </div>
        <p className="text-center text-[14px]">
          <Link href="/login" className="font-medium text-muted-foreground transition-colors hover:text-foreground">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Brand */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Shield className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="text-center">
          <h1 className="text-[24px] font-semibold tracking-tight">
            Reset Your Password
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Enter your email address and we&apos;ll send you a link to reset
            your password.
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-card p-8 shadow-premium">
        {error && (
          <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-primary/20 bg-accent px-4 py-3 text-[14px] text-accent-foreground">
            {success}
          </div>
        )}

        {!success && (
          <form action={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="text-[13px] font-medium leading-none"
              >
                Email address
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

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        )}
      </div>

      <p className="text-center text-[14px]">
        <Link
          href="/login"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
