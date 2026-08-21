import Google from '@auth/core/providers/google';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

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
  verify: ResendOTP,
  reset: ResendOTPPasswordReset,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [CustomPassword, Google],
});
