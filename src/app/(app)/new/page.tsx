import type { Metadata } from 'next';

import { EmptyState } from '@/components/dashboard/empty-state';

export const metadata: Metadata = {
  title: 'Start a New Case',
};

/**
 * PRD §6.2 step 1: "Wedge identification (two tiles, or pre-selected by entry route)."
 *
 * This is the first screen of the progressive flow. The user picks their wedge
 * (deposit or subscription) and proceeds directly into the diagnostic.
 * Not a dashboard. Not an overview. The first step toward recovered money.
 */
export default function NewCasePage(): React.JSX.Element {
  return <EmptyState />;
}
