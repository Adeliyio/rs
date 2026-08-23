import type { Metadata } from 'next';
import { DepositStatePage } from '@/features/seo/deposit-state-page';
import { buildMetadata } from '@/lib/seo/metadata';
import { JURISDICTIONS } from '@/lib/seo/config';

const J = JURISDICTIONS.find((j) => j.code === 'NY')!;
export const metadata: Metadata = buildMetadata({
  title: J.page.title,
  description: J.page.description,
  path: J.page.path,
});

export default function NewYorkDepositPage() {
  return (
    <DepositStatePage
      stateCode="NY"
      stateName="New York"
      returnDeadline="14 days"
      primaryStatute="N.Y. Gen. Oblig. Law §7-108"
      statuteSummary="Requires landlords to return security deposits within 14 days of move-out, along with an itemized statement of deductions."
      penaltyNote="Reasonable attorney fees may be awarded if deposit is wrongfully withheld."
    />
  );
}
