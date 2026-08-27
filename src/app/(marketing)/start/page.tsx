import type { Metadata } from 'next';

import { AnonymousFlow } from '@/features/diagnostic/anonymous/anonymous-flow';
import { WEDGE, type Wedge } from '@/types/enums';

export const metadata: Metadata = {
  title: 'Start Your Free Diagnostic',
  description:
    'See what your state’s law says about your security deposit or subscription cancellation — free, no account needed to start.',
};

/**
 * Value-first funnel entry (SPEC.md M3). PUBLIC route (added to middleware
 * PUBLIC_ROUTES): a brand-new visitor runs the anonymous diagnostic here with no
 * account. Marketing CTAs deep-link with `?wedge=deposit|subscription` (and the
 * legacy `?plan=unlimited`, mapped to subscription) to pre-select the wedge.
 *
 * The cancellation wedge completes fully anonymously; the deposit wedge reveals
 * the full result anonymously and gates on email only at the value/cost boundary.
 */
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ wedge?: string; plan?: string }>;
}): Promise<React.JSX.Element> {
  const { wedge, plan } = await searchParams;

  const initialWedge: Wedge | undefined =
    wedge && (WEDGE as readonly string[]).includes(wedge)
      ? (wedge as Wedge)
      : plan === 'unlimited'
        ? 'subscription'
        : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
      <AnonymousFlow initialWedge={initialWedge} />
    </main>
  );
}
