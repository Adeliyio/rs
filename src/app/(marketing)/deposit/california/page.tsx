import type { Metadata } from 'next';
import { DepositStatePage } from '@/features/seo/deposit-state-page';
import { buildMetadata } from '@/lib/seo/metadata';
import { JURISDICTIONS } from '@/lib/seo/config';

const J = JURISDICTIONS.find((j) => j.code === 'CA')!;
export const metadata: Metadata = buildMetadata({
  title: J.page.title,
  description: J.page.description,
  path: J.page.path,
});

export default function CaliforniaDepositPage() {
  return (
    <DepositStatePage
      stateCode="CA"
      stateName="California"
      returnDeadline="21 calendar days"
      primaryStatute="Cal. Civ. Code §1950.5"
      statuteSummary="Requires landlords to return security deposits within 21 calendar days of move-out, along with an itemized statement of deductions."
      penaltyNote="Up to 2x the deposit amount in bad-faith cases."
    />
  );
}
