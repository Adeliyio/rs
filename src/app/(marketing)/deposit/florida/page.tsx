import type { Metadata } from 'next';
import { DepositStatePage } from '@/features/seo/deposit-state-page';

export const metadata: Metadata = {
  title: 'Florida Security Deposit Recovery',
  description:
    'Recover your security deposit in Florida. Demand letter grounded in Fla. Stat. §83.49 — 15 to 30-day return deadline. Writing assistance, not legal advice.',
  openGraph: {
    title: 'Florida Security Deposit Recovery | Resolvaio',
    description:
      'Draft a demand letter citing Fla. Stat. §83.49. 15-30 day deadline to return your deposit.',
  },
};

export default function FloridaDepositPage() {
  return (
    <DepositStatePage
      stateCode="FL"
      stateName="Florida"
      returnDeadline="15 days (no claim) or 30 days (with claim)"
      primaryStatute="Fla. Stat. §83.49"
      statuteSummary="Requires landlords to return deposits within 15 days if no claim, or 30 days with an itemized claim sent via certified mail."
      penaltyNote="Deposit amount plus interest if landlord fails to comply."
    />
  );
}
