import { redirect } from 'next/navigation';

/**
 * Legacy password-update page.
 *
 * Under Supabase this handled the emailed recovery-link flow. With Convex Auth,
 * password reset is an OTP-code flow handled entirely on /forgot-password
 * (request a code, then submit the code + new password). This route now just
 * redirects there so any old bookmarks/links keep working.
 */
export default function UpdatePasswordPage() {
  redirect('/forgot-password');
}
