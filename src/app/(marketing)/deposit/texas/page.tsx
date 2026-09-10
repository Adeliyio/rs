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
      // Both strings track kb/deposit/TX/kb-entry.json. Texas has two elements
      // the shorter phrasing dropped: the 30-day clock starts only once the
      // tenant gives a WRITTEN forwarding address (§92.103/§92.107), and the
      // 3x + $100 remedy requires BAD FAITH retention (§92.109), not merely a
      // failure to return. Stating it unconditionally overstated the remedy.
      statuteSummary="Requires landlords to return security deposits within 30 days after you surrender the property and give a written forwarding address, with an itemized statement of deductions if any portion is withheld."
      penaltyNote="For bad-faith retention: $100 plus 3x the portion wrongfully withheld, plus reasonable attorney's fees."
    />
  );
}
