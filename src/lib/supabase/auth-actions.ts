'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { createClient } from './server';
import { checkRateLimit } from '@/lib/rate-limit';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Extracts the client IP from request headers in a server action context.
 * Prioritises CF-Connecting-IP (Cloudflare, cannot be spoofed) over
 * X-Forwarded-For (can be spoofed without a trusted proxy).
 */
async function getActionClientIp(): Promise<string> {
  const h = await headers();
  const cfIp = h.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}

/**
 * Sign in with email and password.
 * Returns an error object on failure; redirects to /new on success.
 */
export async function signIn(
  formData: FormData,
): Promise<{ error: string } | never> {
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;

  if (!email || !password) {
    return { error: 'Please enter both your email and password.' };
  }

  // Rate limit by IP to prevent brute-force attacks (VULN-08)
  const ip = await getActionClientIp();
  const rateResult = await checkRateLimit('auth', `login:${ip}`);
  if (!rateResult.allowed) {
    return { error: 'Too many login attempts. Please try again in a few minutes.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: 'Invalid email or password. Please try again.' };
  }

  redirect('/new');
}

/**
 * Register a new account with email and password.
 * Returns an error object on failure; redirects to a confirmation page on success.
 */
export async function signUp(
  formData: FormData,
): Promise<{ error: string } | never> {
  const fullName = (formData.get('fullName') as string | null)?.trim() ?? '';
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;
  const confirmPassword = formData.get('confirmPassword') as string | null;

  if (!fullName) {
    return { error: 'Please enter your full name.' };
  }

  if (!email || !password) {
    return { error: 'Please fill in all required fields.' };
  }

  // Rate limit by IP to prevent account enumeration (VULN-08)
  const ip = await getActionClientIp();
  const rateResult = await checkRateLimit('auth', `signup:${ip}`);
  if (!rateResult.allowed) {
    return { error: 'Too many registration attempts. Please try again in a few minutes.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  if (!/[A-Z]/.test(password)) {
    return { error: 'Password must contain at least one uppercase letter.' };
  }

  if (!/[0-9]/.test(password)) {
    return { error: 'Password must contain at least one number.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return {
      error:
        'We could not create your account. The email may already be registered.',
    };
  }

  redirect('/login?message=Check your email to confirm your account.');
}

/**
 * Sign out the current user and redirect to the landing page.
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

/**
 * Initiate Google OAuth sign-in.
 * Redirects the browser to Google's consent screen.
 */
export async function signInWithGoogle(): Promise<{ error: string } | never> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.APP_URL ?? 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error || !data.url) {
    return { error: 'Could not initiate Google sign-in. Please try again.' };
  }

  redirect(data.url);
}

/**
 * Send a password reset email.
 * Returns an error object on failure; returns a success hint otherwise.
 */
export async function resetPassword(
  formData: FormData,
): Promise<{ error: string } | { success: string }> {
  const email = formData.get('email') as string | null;

  if (!email) {
    return { error: 'Please enter your email address.' };
  }

  // Rate limit by IP to prevent email-bombing and Resend credit waste (VULN-08)
  const ip = await getActionClientIp();
  const rateResult = await checkRateLimit('auth', `reset:${ip}`);
  if (!rateResult.allowed) {
    return { error: 'Too many reset requests. Please try again in a few minutes.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.APP_URL ?? 'http://localhost:3000'}/auth/callback`,
  });

  if (error) {
    return { error: 'Unable to send reset email. Please try again later.' };
  }

  return {
    success:
      'If an account with that email exists, you will receive a password reset link.',
  };
}
