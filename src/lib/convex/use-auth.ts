'use client';

import { useRouter } from 'next/navigation';

import { authClient } from '@/lib/auth-client';
import { checkAuthRateLimit } from './rate-limit-action';

/**
 * Client-side auth flows for Resolvaio, built on Better Auth's browser client
 * (replaces @convex-dev/auth's useAuthActions).
 *
 * Better Auth client methods return `{ data, error }` — they do NOT throw — so
 * each flow inspects `error` rather than using try/catch. Rate limiting stays
 * server-side (Redis) via the `checkAuthRateLimit` server action, called before
 * the sensitive operations (preserving the old VULN-08 protection).
 *
 * Flows:
 *  - signIn:          authClient.signIn.email({ email, password })
 *  - signUp:          authClient.signUp.email({ email, password, name })
 *                     → auto-sends an 8-digit email-verification OTP
 *  - resend / verify: authClient.emailOtp.sendVerificationOtp / verifyEmail
 *  - reset request:   authClient.emailOtp.requestPasswordReset({ email })
 *  - reset confirm:   authClient.emailOtp.resetPassword({ email, otp, password })
 *
 * The return-shape contract ({ error?, pending?, alreadyExists?, sent?, success? })
 * is unchanged so the login/register pages did not need edits.
 */
export function useResolvaioAuth() {
  const router = useRouter();

  return {
    async login(email: string, password: string): Promise<{ error?: string }> {
      const rl = await checkAuthRateLimit('login');
      if (!rl.allowed) return { error: 'Too many login attempts. Please try again in a few minutes.' };
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        // An unverified account gets a clear nudge instead of "invalid password".
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('verif') || error.status === 403) {
          return { error: 'Please confirm your email first. Check your inbox for the code.' };
        }
        return { error: 'Invalid email or password. Please try again.' };
      }
      router.push('/new');
      return {};
    },

    async register(
      fullName: string,
      email: string,
      password: string,
    ): Promise<{ error?: string; pending?: boolean; alreadyExists?: boolean }> {
      const rl = await checkAuthRateLimit('signup');
      if (!rl.allowed) return { error: 'Too many registration attempts. Please try again in a few minutes.' };
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: fullName,
      });
      if (error) {
        const message = (error.message ?? '').toLowerCase();
        // eslint-disable-next-line no-console
        console.error('[auth] signUp failed:', error.message, error);
        if (message.includes('already') || message.includes('exists') || message.includes('duplicate')) {
          return {
            error: 'An account with that email already exists.',
            alreadyExists: true,
          };
        }
        if (message.includes('password')) {
          return { error: 'Password does not meet the requirements. Use 8+ characters with an uppercase letter and a number.' };
        }
        return {
          error: 'We could not create your account right now. Please try again in a moment.',
        };
      }
      // NOTE on duplicate emails: with requireEmailVerification, Better Auth's
      // anti-enumeration path returns a FAKE success ({ token: null, user }) for
      // an already-registered email and does NOT update the stored password
      // (sign-up.mjs:203). We deliberately do NOT branch on `token` to detect
      // this: a GENUINE new signup ALSO returns token:null here (sign-up.mjs:252,
      // because shouldSkipAutoSignIn is true under requireEmailVerification), so
      // the two are indistinguishable on the client. Detecting a duplicate
      // reliably would need a server-side pre-check (findUserByEmail) — a
      // separate change. For now both paths continue to the OTP step; a returning
      // user simply won't receive a NEW-account code and can use "Sign in" /
      // "Forgot password" instead.
      return { pending: true };
    },

    /**
     * Resend the verification code to a PENDING account. Sends a fresh 8-digit
     * email-verification OTP. fullName/password are unused but kept for a stable
     * signature (the register page passes them through).
     */
    async resendCode(
      _fullName: string,
      email: string,
      _password: string,
    ): Promise<{ error?: string; sent?: boolean }> {
      const rl = await checkAuthRateLimit('signup');
      if (!rl.allowed) return { error: 'Too many requests. Please wait a few minutes before requesting another code.' };
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[auth] resendCode failed:', error.message, error);
        return { error: 'Could not resend the code right now. Please try again in a moment.' };
      }
      return { sent: true };
    },

    async verifyEmail(email: string, code: string): Promise<{ error?: string }> {
      // Rate-limit code submission (per-IP+email via the 'login' bucket) so the
      // 8-digit OTP can't be brute-forced for account takeover.
      const rl = await checkAuthRateLimit('login');
      if (!rl.allowed) return { error: 'Too many attempts. Please try again in a few minutes.' };
      const { error } = await authClient.emailOtp.verifyEmail({ email, otp: code });
      if (error) {
        const message = (error.message ?? '').toLowerCase();
        // eslint-disable-next-line no-console
        console.error('[auth] verifyEmail failed:', error.message, error);
        if (message.includes('code') || message.includes('expired') || message.includes('invalid') || message.includes('otp')) {
          return { error: 'That code was invalid or expired. Please try again.' };
        }
        return { error: 'We could not confirm your code right now. Please try again in a moment.' };
      }
      router.push('/new');
      return {};
    },

    async requestReset(email: string): Promise<{ error?: string; success?: string }> {
      const rl = await checkAuthRateLimit('reset');
      if (!rl.allowed) return { error: 'Too many reset requests. Please try again in a few minutes.' };
      // Fire and forget — never reveal whether the account exists.
      await authClient.emailOtp.requestPasswordReset({ email });
      return { success: 'If an account with that email exists, you will receive a password reset code.' };
    },

    async confirmReset(
      email: string,
      code: string,
      newPassword: string,
    ): Promise<{ error?: string }> {
      // Rate-limit reset-code submission (per-IP+email) so the reset OTP can't be
      // brute-forced into an account takeover.
      const rl = await checkAuthRateLimit('reset');
      if (!rl.allowed) return { error: 'Too many attempts. Please try again in a few minutes.' };
      const { error } = await authClient.emailOtp.resetPassword({
        email,
        otp: code,
        password: newPassword,
      });
      if (error) {
        const message = (error.message ?? '').toLowerCase();
        // eslint-disable-next-line no-console
        console.error('[auth] confirmReset failed:', error.message, error);
        if (message.includes('code') || message.includes('expired') || message.includes('invalid') || message.includes('otp')) {
          return { error: 'That code was invalid or expired. Please request a new one.' };
        }
        if (message.includes('password')) {
          return { error: 'Password does not meet the requirements. Use 8+ characters with an uppercase letter and a number.' };
        }
        return { error: 'We could not reset your password right now. Please try again in a moment.' };
      }
      router.push('/login?message=Your password has been reset. Please sign in.');
      return {};
    },

    async logout(): Promise<void> {
      await authClient.signOut();
      router.push('/');
    },
  };
}
