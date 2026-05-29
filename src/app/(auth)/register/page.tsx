'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Shield } from 'lucide-react';

import { signUp, signInWithGoogle } from '@/lib/supabase/auth-actions';
import { Button } from '@/components/ui/button';

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);

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
    const result = await signUp(formData);
    if (result?.error) {
      setFormError(result.error);
    }
  }

  const errorMessage = formError;

  return (
    <div className="flex flex-col gap-8">
      {/* Brand */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Shield className="h-6 w-6 text-primary-foreground" />
        </div>
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

        {/* Google OAuth */}
        <form
          action={async () => {
            await signInWithGoogle();
          }}
        >
          <Button
            type="submit"
            variant="outline"
            className="w-full gap-2"
            size="lg"
          >
            <GoogleIcon />
            Sign up with Google
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-[12px] uppercase tracking-wider">
            <span className="bg-card px-3 text-muted-foreground">
              or continue with email
            </span>
          </div>
        </div>

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
