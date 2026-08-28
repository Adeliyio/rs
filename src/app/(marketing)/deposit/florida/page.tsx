import type { Metadata } from 'next';
import { DepositStatePage } from '@/features/seo/deposit-state-page';
import { buildMetadata } from '@/lib/seo/metadata';
import { JURISDICTIONS } from '@/lib/seo/config';

const J = JURISDICTIONS.find((j) => j.code === 'FL')!;
export const metadata: Metadata = buildMetadata({
  title: J.page.title,
  description: J.page.description,
  path: J.page.path,
});

export default function FloridaDepositPage() {
  return (
    <DepositStatePage
      stateCode="FL"
      stateName="Florida"
      returnDeadline="15 days (no claim) or 30 days (with claim)"
      primaryStatute="Fla. Stat. §83.49"
      statuteSummary="Requires landlords to return deposits within 15 days if no claim, or 30 days with an itemized claim sent via certified mail."
      penaltyNote="If the landlord misses the 30-day certified-mail notice, they forfeit the right to keep any of the deposit — plus you may recover attorney's fees and court costs."
    />
  );
}
