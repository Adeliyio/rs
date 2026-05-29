import type { Metadata } from 'next';
import { DepositStatePage } from '@/features/seo/deposit-state-page';

export const metadata: Metadata = {
  title: 'New York Security Deposit Recovery',
  description:
    'Recover your security deposit in New York. Demand letter grounded in N.Y. Gen. Oblig. Law §7-108 — 14-day return deadline. Writing assistance, not legal advice.',
  openGraph: {
    title: 'New York Security Deposit Recovery | Resolvaio',
    description:
      'Draft a demand letter citing N.Y. Gen. Oblig. Law §7-108. 14-day deadline to return your deposit.',
  },
};

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
