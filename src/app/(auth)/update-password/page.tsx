'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Shield } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;
    const confirmPassword = form.get('confirmPassword') as string;

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError('Unable to update password. The link may have expired — please request a new one.');
      setIsSubmitting(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push('/new'), 2000);
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
            Set New Password
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Enter your new password below.
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

        {success ? (
          <div className="rounded-xl border border-primary/20 bg-accent px-4 py-3 text-[14px] text-accent-foreground">
            Password updated successfully. Redirecting...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="text-[13px] font-medium leading-none"
              >
                New password
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
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Confirm your password"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-[14px] ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
