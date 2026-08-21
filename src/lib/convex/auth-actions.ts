'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { signIn, signOut } from '@convex-dev/auth/nextjs/server';

import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Auth server actions — Convex Auth replacement for the former Supabase
 * auth-actions.ts.
 *
 * Flow differences (Convex Auth Password provider):
 * - Sign-up requires EMAIL VERIFICATION via an OTP code (flow: 'signUp' then a
 *   second call with flow: 'email-verification' + code). The register page
 *   drives the two steps; this module exposes the primitives.
 * - Password reset is OTP-based: request a code (flow: 'reset'), then submit the
 *   code + new password (flow: 'reset-verification').
 * - Google OAuth: signIn('google') returns a redirect handled by Convex Auth's
 *   HTTP routes.
 *
 * Rate limiting by IP is preserved for login/signup/reset.
 */

async function clientIp(): Promise<string> {
  const h = await headers();
  const cf = h.get('cf-connecting-ip');
  if (cf) return cf;
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Sign in (password)                                                */
/* ------------------------------------------------------------------ */

export async function signInAction(
  formData: FormData,
): Promise<{ error: string } | never> {
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;
  if (!email || !password) {
    return { error: 'Please enter both your email and password.' };
  }

  const rate = await checkRateLimit('auth', `login:${await clientIp()}`);
  if (!rate.allowed) {
    return { error: 'Too many login attempts. Please try again in a few minutes.' };
  }

  try {
    await signIn('password', { email, password, flow: 'signIn' });
  } catch {
    return { error: 'Invalid email or password. Please try again.' };
  }
  redirect('/new');
}

/* ------------------------------------------------------------------ */
/*  Sign up (password) — step 1: create account + send OTP            */
/* ------------------------------------------------------------------ */

export async function signUpAction(
  formData: FormData,
): Promise<{ error: string } | { pendingEmail: string } | never> {
  const fullName = (formData.get('fullName') as string | null)?.trim() ?? '';
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;
  const confirmPassword = formData.get('confirmPassword') as string | null;

  if (!fullName) return { error: 'Please enter your full name.' };
  if (!email || !password) return { error: 'Please fill in all required fields.' };

  const rate = await checkRateLimit('auth', `signup:${await clientIp()}`);
  if (!rate.allowed) {
    return { error: 'Too many registration attempts. Please try again in a few minutes.' };
  }

  if (password !== confirmPassword) return { error: 'Passwords do not match.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (!/[A-Z]/.test(password)) return { error: 'Password must contain at least one uppercase letter.' };
  if (!/[0-9]/.test(password)) return { error: 'Password must contain at least one number.' };

  try {
    // Password provider with `verify` set starts the email-verification flow:
    // the account is created and a code is emailed. The user then confirms.
    await signIn('password', { email, password, fullName, flow: 'signUp' });
  } catch {
    return { error: 'We could not create your account. The email may already be registered.' };
  }
  return { pendingEmail: email };
}

/** Step 2: confirm the emailed OTP code. */
export async function verifyEmailAction(
  formData: FormData,
): Promise<{ error: string } | never> {
  const email = formData.get('email') as string | null;
  const code = formData.get('code') as string | null;
  if (!email || !code) return { error: 'Please enter the code we emailed you.' };
  try {
    await signIn('password', { email, code, flow: 'email-verification' });
  } catch {
    return { error: 'That code was invalid or expired. Please try again.' };
  }
  redirect('/new');
}

/* ------------------------------------------------------------------ */
/*  Sign out                                                          */
/* ------------------------------------------------------------------ */

export async function signOutAction(): Promise<never> {
  await signOut();
  redirect('/');
}

/* ------------------------------------------------------------------ */
/*  Google OAuth                                                      */
/* ------------------------------------------------------------------ */

export async function signInWithGoogleAction(): Promise<{ error: string } | never> {
  try {
    // Convex Auth handles the OAuth redirect via its HTTP routes.
    await signIn('google');
  } catch {
    return { error: 'Could not initiate Google sign-in. Please try again.' };
  }
  // signIn('google') triggers the redirect; this is unreachable on success.
  redirect('/new');
}

/* ------------------------------------------------------------------ */
/*  Password reset (OTP)                                              */
/* ------------------------------------------------------------------ */

/** Step 1: request a reset code. */
export async function requestPasswordResetAction(
  formData: FormData,
): Promise<{ error: string } | { success: string }> {
  const email = formData.get('email') as string | null;
  if (!email) return { error: 'Please enter your email address.' };

  const rate = await checkRateLimit('auth', `reset:${await clientIp()}`);
  if (!rate.allowed) {
    return { error: 'Too many reset requests. Please try again in a few minutes.' };
  }

  try {
    await signIn('password', { email, flow: 'reset' });
  } catch {
    // Do not reveal whether the account exists.
  }
  return {
    success:
      'If an account with that email exists, you will receive a password reset code.',
  };
}

/** Step 2: submit the code + new password. */
export async function confirmPasswordResetAction(
  formData: FormData,
): Promise<{ error: string } | never> {
  const email = formData.get('email') as string | null;
  const code = formData.get('code') as string | null;
  const password = formData.get('password') as string | null;
  if (!email || !code || !password) {
    return { error: 'Please fill in all fields.' };
  }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  try {
    await signIn('password', { email, code, newPassword: password, flow: 'reset-verification' });
  } catch {
    return { error: 'That code was invalid or expired. Please request a new one.' };
  }
  redirect('/login?message=Your password has been reset. Please sign in.');
}
