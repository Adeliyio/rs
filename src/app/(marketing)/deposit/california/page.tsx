import type { Metadata } from 'next';
import { DepositStatePage } from '@/features/seo/deposit-state-page';

export const metadata: Metadata = {
  title: 'California Security Deposit Recovery',
  description:
    'Recover your security deposit in California. Demand letter grounded in Cal. Civ. Code §1950.5 — 21-day return deadline. Writing assistance, not legal advice.',
  openGraph: {
    title: 'California Security Deposit Recovery | Resolvaio',
    description:
      'Draft a demand letter citing Cal. Civ. Code §1950.5. 21-day deadline to return your deposit.',
  },
};

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
