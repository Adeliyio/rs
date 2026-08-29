'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LogoIcon } from '@/components/logo';

import { useResolvaioAuth } from '@/lib/convex/use-auth';
import { GoogleButton } from '@/components/auth/google-button';
import { Button } from '@/components/ui/button';


export default function RegisterPage() {
  const auth = useResolvaioAuth();
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // After account creation, we switch to the OTP-code step.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function handleSubmit(formData: FormData): Promise<void> {
    if (busy) return;
    const fullName = ((formData.get('fullName') as string | null) ?? '').trim();
    const email = (formData.get('email') as string | null) ?? '';
    const password = formData.get('password') as string | null;
    const confirmPassword = formData.get('confirmPassword') as string | null;

    if (!fullName) {
      setFormError('Please enter your full name.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      setFormError('Passwords do not match.');
      return;
    }
    if (!password || password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setFormError('Password must contain at least one uppercase letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setFormError('Password must contain at least one number.');
      return;
    }

    setPasswordMismatch(false);
    setFormError(null);
    setBusy(true);
    try {
      const result = await auth.register(fullName, email, password);
      if (result.error) {
        setFormError(result.error);
      } else if (result.pending) {
        setPendingEmail(email);
      }
    } catch {
      // Backstop: register() returns errors, but if anything upstream throws
      // (e.g. the rate-limit action), never leave the form frozen with no message.
      setFormError('Something went wrong creating your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(formData: FormData): Promise<void> {
    if (busy) return;
    setFormError(null);
    const email = (formData.get('email') as string | null) ?? '';
    const code = (formData.get('code') as string | null) ?? '';
    setBusy(true);
    try {
      const result = await auth.verifyEmail(email, code);
      if (result.error) setFormError(result.error);
    } catch {
      setFormError('Something went wrong confirming your code. Please try again.');
    } finally {
      setBusy(false);
    }
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
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm & continue'}
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
              minLength={8}
              placeholder="8+ chars, 1 uppercase, 1 number"
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
              minLength={8}
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

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-5">
          <GoogleButton label="Sign up with Google" />
        </div>
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
