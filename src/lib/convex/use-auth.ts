'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'next/navigation';

import { checkAuthRateLimit } from './rate-limit-action';

/**
 * Client-side auth flows for Resolvaio, built on Convex Auth's useAuthActions.
 *
 * Convex Auth exposes signIn/signOut as CLIENT actions (not server actions), so
 * the auth pages are client components that call this hook. Rate limiting stays
 * server-side (Redis) via the `checkAuthRateLimit` server action, called before
 * the sensitive operations — preserving the old VULN-08 protection.
 *
 * Password flows (provider id 'password'):
 *  - signIn:            { email, password, flow: 'signIn' }
 *  - signUp:            { email, password, fullName, flow: 'signUp' } → emails OTP
 *  - verify email:      { email, code, flow: 'email-verification' }
 *  - request reset:     { email, flow: 'reset' } → emails OTP
 *  - confirm reset:     { email, code, newPassword, flow: 'reset-verification' }
 * Google OAuth: signIn('google').
 */
export function useResolvaioAuth() {
  const { signIn, signOut } = useAuthActions();
  const router = useRouter();

  return {
    async login(email: string, password: string): Promise<{ error?: string }> {
      const rl = await checkAuthRateLimit('login');
      if (!rl.allowed) return { error: 'Too many login attempts. Please try again in a few minutes.' };
      try {
        await signIn('password', { email, password, flow: 'signIn' });
        router.push('/new');
        return {};
      } catch {
        return { error: 'Invalid email or password. Please try again.' };
      }
    },

    async register(
      fullName: string,
      email: string,
      password: string,
    ): Promise<{ error?: string; pending?: boolean }> {
      const rl = await checkAuthRateLimit('signup');
      if (!rl.allowed) return { error: 'Too many registration attempts. Please try again in a few minutes.' };
      try {
        await signIn('password', { email, password, fullName, flow: 'signUp' });
        return { pending: true };
      } catch (err) {
        // Surface the real cause instead of masking every failure as
        // "email already registered". Convex Auth throws a variety of errors
        // (misconfigured provider, OTP/email send failure, validation) that all
        // arrive here — logging + inspecting the message is the only way to tell.
        const message = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error('[auth] signUp failed:', message, err);

        const lower = message.toLowerCase();
        if (lower.includes('already') || lower.includes('exists') || lower.includes('duplicate')) {
          return { error: 'That email is already registered. Try signing in instead.' };
        }
        if (lower.includes('password')) {
          return { error: 'Password does not meet the requirements. Use 8+ characters with an uppercase letter and a number.' };
        }
        // Unknown failure — show enough to diagnose rather than a misleading guess.
        return {
          error:
            'We could not create your account right now. Please try again in a moment.',
        };
      }
    },

    async verifyEmail(email: string, code: string): Promise<{ error?: string }> {
      try {
        await signIn('password', { email, code, flow: 'email-verification' });
        router.push('/new');
        return {};
      } catch {
        return { error: 'That code was invalid or expired. Please try again.' };
      }
    },

    async requestReset(email: string): Promise<{ error?: string; success?: string }> {
      const rl = await checkAuthRateLimit('reset');
      if (!rl.allowed) return { error: 'Too many reset requests. Please try again in a few minutes.' };
      try {
        await signIn('password', { email, flow: 'reset' });
      } catch {
        // do not reveal whether the account exists
      }
      return { success: 'If an account with that email exists, you will receive a password reset code.' };
    },

    async confirmReset(
      email: string,
      code: string,
      newPassword: string,
    ): Promise<{ error?: string }> {
      try {
        await signIn('password', { email, code, newPassword, flow: 'reset-verification' });
        router.push('/login?message=Your password has been reset. Please sign in.');
        return {};
      } catch {
        return { error: 'That code was invalid or expired. Please request a new one.' };
      }
    },

    async google(): Promise<{ error?: string }> {
      try {
        await signIn('google');
        return {};
      } catch {
        return { error: 'Could not initiate Google sign-in. Please try again.' };
      }
    },

    async logout(): Promise<void> {
      await signOut();
      router.push('/');
    },
  };
}
