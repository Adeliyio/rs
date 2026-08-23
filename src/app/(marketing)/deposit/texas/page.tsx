import type { Metadata } from 'next';
import { DepositStatePage } from '@/features/seo/deposit-state-page';
import { buildMetadata } from '@/lib/seo/metadata';
import { JURISDICTIONS } from '@/lib/seo/config';

const J = JURISDICTIONS.find((j) => j.code === 'TX')!;
export const metadata: Metadata = buildMetadata({
  title: J.page.title,
  description: J.page.description,
  path: J.page.path,
});

export default function TexasDepositPage() {
  return (
    <DepositStatePage
      stateCode="TX"
      stateName="Texas"
      returnDeadline="30 days"
      primaryStatute="Tex. Prop. Code §92.103"
      statuteSummary="Requires landlords to return security deposits within 30 days of move-out, with an itemized statement of deductions if any portion is withheld."
      penaltyNote="Up to 3x the wrongfully withheld amount plus $100."
    />
  );
}
