import type { Metadata } from 'next';

import { ResumeAfterLogin } from '@/features/diagnostic/anonymous/resume-after-login';

export const metadata: Metadata = {
  title: 'Resuming your case',
  robots: { index: false, follow: false },
};

/**
 * Post-login landing for a visitor who ran the anonymous deposit diagnostic,
 * turned out to already have an account, and signed in instead of registering.
 *
 * `/start` is public; `/start/resume` deliberately is NOT (middleware matches
 * PUBLIC_ROUTES exactly), so this page only renders with a session — which is
 * what makes it safe to create a case and hydrate it here.
 *
 * The answers themselves arrive in sessionStorage, stashed by the email-capture
 * step immediately before it navigated to /login. Without that hand-off the
 * visitor would land in an empty funnel and have to answer everything twice.
 */
export default function StartResumePage(): React.JSX.Element {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
      <ResumeAfterLogin />
    </main>
  );
}
