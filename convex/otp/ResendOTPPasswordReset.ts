import Resend from '@auth/core/providers/resend';
import { Resend as ResendAPI } from 'resend';
import { generateRandomString, type RandomReader } from '@oslojs/crypto/random';

/**
 * Password-reset OTP provider for Convex Auth.
 *
 * Emails the user an 8-digit code to authorise a password reset.
 * Replaces the former Supabase resetPasswordForEmail link flow.
 *
 * Requires the AUTH_RESEND_KEY Convex env var (the Resend API key).
 */
export const ResendOTPPasswordReset = Resend({
  id: 'resend-otp-password-reset',
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15, // codes valid for 15 minutes
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, '0123456789', 8);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'Resolvaio <onboarding@resolvaio.com>',
      to: [email],
      subject: 'Reset your Resolvaio password',
      text: `Your Resolvaio password reset code is ${token}. It expires in 15 minutes. If you did not request this, you can ignore this email.`,
    });
    if (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
