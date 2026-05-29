import type { Metadata } from 'next';
import { DepositStatePage } from '@/features/seo/deposit-state-page';

export const metadata: Metadata = {
  title: 'Texas Security Deposit Recovery',
  description:
    'Recover your security deposit in Texas. Demand letter grounded in Tex. Prop. Code §92.103 — 30-day return deadline. Writing assistance, not legal advice.',
  openGraph: {
    title: 'Texas Security Deposit Recovery | Resolvaio',
    description:
      'Draft a demand letter citing Tex. Prop. Code §92.103. 30-day deadline to return your deposit.',
  },
  alternates: {
    canonical: 'https://resolvaio.com/deposit/texas',
  },
};

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
