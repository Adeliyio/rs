import type { Metadata } from 'next';

import { EmptyState } from '@/components/dashboard/empty-state';

export const metadata: Metadata = {
  title: 'Start a New Case',
};

/**
 * PRD §6.2 step 1: "Wedge identification (two tiles, or pre-selected by entry route)."
 *
 * The first screen of the progressive flow. Marketing CTAs deep-link here with
 * `?wedge=deposit|subscription` (and legacy `?plan=unlimited`); we forward that
 * hint to EmptyState so the correct state picker opens immediately instead of
 * forcing the user to re-pick the wedge (fixes A1).
 */
export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ wedge?: string; plan?: string; fresh?: string }>;
}): Promise<React.JSX.Element> {
  const { wedge, plan, fresh } = await searchParams;

  // `?plan=unlimited` came from the subscription pricing CTA → subscription wedge.
  const preselect =
    wedge === 'deposit' || wedge === 'subscription'
      ? wedge
      : plan === 'unlimited'
        ? 'subscription'
        : undefined;

  // `?fresh=<ts>` comes from the sidebar "New Case" button. Using it as a key
  // remounts EmptyState so any open picker / error state is reset — this is what
  // makes "New Case" do something when the user is already on /new.
  return <EmptyState key={fresh ?? 'default'} preselectWedge={preselect} />;
}
