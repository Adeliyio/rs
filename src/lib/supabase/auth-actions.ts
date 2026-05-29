'use server';

import { redirect } from 'next/navigation';

import { createClient } from './server';

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

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
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
