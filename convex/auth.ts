import Google from '@auth/core/providers/google';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';

import { ResendOTP } from './otp/ResendOTP';
import { ResendOTPPasswordReset } from './otp/ResendOTPPasswordReset';
import type { DataModel } from './_generated/dataModel';

/**
 * Convex Auth configuration — replaces Supabase Auth.
 *
 * Providers:
 * - Password: email/password with email verification (ResendOTP) and password
 *   reset (ResendOTPPasswordReset). NOTE: verification and reset are 8-digit
 *   OTP CODES emailed to the user, not magic links — this is a deliberate UX
 *   change from the former Supabase link-based flows.
 * - Google OAuth: requires AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET env vars.
 *
 * The Password profile carries `fullName` through sign-up so it lands on the
 * users table (the former Supabase `options.data.full_name`).
 */

const CustomPassword = Password<DataModel>({
  profile(params) {
    return {
      email: params.email as string,
      name: (params.fullName as string | undefined) ?? undefined,
    };
  },
  // SECURITY: enforce the password policy on the SERVER. The 8-char/uppercase/
  // number rule previously lived only in the React forms, so a scripted client
  // calling signIn('password', … flow:'signUp') directly could register a
  // 1-character password. This closes that bypass.
  validatePasswordRequirements: (password: string) => {
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      throw new ConvexError(
        'Password must be at least 8 characters and include an uppercase letter and a number.',
      );
    }
  },
  verify: ResendOTP,
  reset: ResendOTPPasswordReset,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [CustomPassword, Google],
});
