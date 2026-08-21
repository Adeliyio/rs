'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LogoIcon } from '@/components/logo';

import { signUpAction, verifyEmailAction } from '@/lib/convex/auth-actions';
import { Button } from '@/components/ui/button';


export default function RegisterPage() {
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // After account creation, we switch to the OTP-code step.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function handleSubmit(formData: FormData): Promise<void> {
    const password = formData.get('password') as string | null;
    const confirmPassword = formData.get('confirmPassword') as string | null;

    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      setFormError('Passwords do not match.');
      return;
    }

    setPasswordMismatch(false);
    setFormError(null);
    const result = await signUpAction(formData);
    if ('error' in result) {
      setFormError(result.error);
    } else {
      // Account created; a verification code was emailed.
      setPendingEmail(result.pendingEmail);
    }
  }

  async function handleVerify(formData: FormData): Promise<void> {
    setFormError(null);
    const result = await verifyEmailAction(formData);
    // verifyEmailAction redirects on success; only returns on error.
    if (result?.error) setFormError(result.error);
  }

  const errorMessage = formError;

  /* ---- Step 2: email verification (OTP code) ---- */
  if (pendingEmail) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4">
          <LogoIcon className="h-12 w-12" />
          <div className="text-center">
            <h1 className="text-[24px] font-semibold tracking-tight">Confirm your email</h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              We emailed an 8-digit code to <strong>{pendingEmail}</strong>. Enter it below.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-8 shadow-premium">
          {errorMessage && (
            <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
              {errorMessage}
            </div>
          )}
          <form action={handleVerify} className="flex flex-col gap-5">
            <input type="hidden" name="email" value={pendingEmail} />
            <div className="flex flex-col gap-2">
              <label htmlFor="code" className="text-[13px] font-medium leading-none">
                Confirmation code
              </label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="12345678"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-[14px] tracking-[0.3em] ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow"
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Confirm &amp; continue
            </Button>
          </form>
        </div>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
          Resolvaio is a writing and research assistance tool, not a law firm.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Brand */}
      <div className="flex flex-col items-center gap-4">
        <LogoIcon className="h-12 w-12" />
        <div className="text-center">
          <h1 className="text-[24px] font-semibold tracking-tight">
            Create your account
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Get started with Resolvaio in seconds
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border bg-card p-8 shadow-premium">
        {/* Error message */}
        {errorMessage && (
          <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
            {errorMessage}
          </div>
        )}

        {/* Registration Form */}
        <form action={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="fullName"
              className="text-[13px] font-medium leading-none"
            >
              Full Name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              placeholder="Jane Doe"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-[14px] ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
            />
          </div>

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
            <label
              htmlFor="password"
              className="text-[13px] font-medium leading-none"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-[14px] ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirmPassword"
              className="text-[13px] font-medium leading-none"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="Re-enter your password"
              className={`flex h-11 w-full rounded-lg border bg-background px-4 py-2 text-[14px] ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow ${
                passwordMismatch
                  ? 'border-destructive focus-visible:ring-destructive'
                  : 'border-input'
              }`}
            />
            {passwordMismatch && (
              <p className="text-[12px] text-destructive">
                Passwords do not match.
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full">
            Create Account
          </Button>
        </form>
      </div>

      {/* Footer links */}
      <p className="text-center text-[14px] text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>

      {/* Disclaimer */}
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
        Resolvaio is a writing and research assistance tool, not a law firm.
      </p>
    </div>
  );
}
