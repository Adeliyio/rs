import type { Metadata } from 'next';
import { VerticalCancelPage } from '@/components/marketing/vertical-cancel-page';
import type { VerticalPageData } from '@/components/marketing/vertical-cancel-page';

export const metadata: Metadata = {
  title: 'Cancel Your Cable, Internet, or Phone Service — Free Email Generator',
  description:
    'Generate a free 3-step cancellation email sequence for telecom services. Cites ROSCA, FCC regulations, and state PUC rules. Works for Comcast, AT&T, Spectrum, Verizon, and more.',
  openGraph: {
    title: 'Cancel Telecom Service — Free | Resolvaio',
    description:
      'Stop paying for cable, internet, or phone service you don\u2019t want. Free cancellation emails citing FCC rules and consumer protection law.',
  },
};

const DATA: VerticalPageData = {
  slug: 'telecom',
  displayName: 'Telecom & Cable',
  heroHeadline: 'Cancel your cable, internet, or phone service.',
  heroSubheadline: 'Skip the 45-minute hold.',
  heroParagraph:
    'Telecom companies use retention departments, hold queues, and early termination fees to make cancellation as painful as possible. Our free tool generates a 3-step email sequence citing ROSCA, FCC regulations, and your state\u2019s consumer protection statutes \u2014 so you have a documented paper trail instead of a he-said-she-said phone call.',
  companies: [
    'Comcast / Xfinity', 'AT&T', 'Verizon', 'T-Mobile',
    'Spectrum', 'Cox', 'CenturyLink', 'Frontier',
    'Dish Network', 'DirecTV',
  ],
  barriers: [
    {
      barrier: 'Early termination fee (ETF)',
      resolution: 'If the company changed your service terms, degraded service quality, or you\u2019re past the contract period, the ETF may not apply. The email cites the specific consumer protection provision that addresses this.',
    },
    {
      barrier: 'Requires a phone call to cancel',
      resolution: 'If you signed up online, the FTC Click-to-Cancel rule requires a simple online cancellation mechanism. A written email with legal citations creates a documented record that a phone call doesn\u2019t.',
    },
    {
      barrier: 'Aggressive retention offers during call',
      resolution: 'Written cancellation removes the retention department from the equation. The company receives a formal request citing applicable law \u2014 not a phone call they can redirect.',
    },
    {
      barrier: 'Keeps charging after cancellation',
      resolution: 'Post-cancellation charges are disputable under the FCBA. Email 2 mentions chargeback rights. Email 3 names the FCC Consumer Complaint Center and state PUC as escalation paths.',
    },
    {
      barrier: 'Equipment return confusion',
      resolution: 'Email 1 requests clear equipment return instructions and deadlines. This creates a paper trail in case the company later claims equipment was not returned.',
    },
    {
      barrier: 'Bundled services complicate cancellation',
      resolution: 'The email specifies exactly which services to cancel and requests a revised bill reflecting only the remaining services. If the bundle terms changed, state consumer protection law may apply.',
    },
  ],
  email1Summary:
    'Cites ROSCA and FCC consumer protection rules. Identifies your account, specifies which services to cancel, revokes payment authorization, and requests written confirmation plus equipment return instructions within 7 business days.',
  email2Summary:
    'References your first email by date. Notes the lack of response. Names the FCC Consumer Complaint Center (which requires the company to respond within 30 days) and your state\u2019s Public Utility Commission. Mentions FCBA chargeback rights.',
  email3Summary:
    'Final notice referencing both previous emails. Provides FCC complaint URL (consumercomplaints.fcc.gov), FTC complaint URL, and state PUC filing information. States that all post-cancellation charges will be disputed with the credit card issuer.',
  laws: [
    {
      name: 'ROSCA / FTC Click-to-Cancel Rule',
      description: 'Federal law requiring simple cancellation mechanisms for online subscriptions. Online sign-ups generally require an online cancellation path.',
    },
    {
      name: 'FCC Consumer Protection',
      description: 'The FCC Consumer Complaint Center accepts complaints about phone, internet, and TV services. Companies must respond to FCC complaints within 30 days \u2014 this is one of the most effective escalation paths for telecom disputes.',
    },
    {
      name: 'State Public Utility Commissions',
      description: 'CA (CPUC), TX (PUCT), NY (PSC), and FL (PSC) regulate telecom providers at the state level. Filing a PUC complaint triggers a formal review process.',
    },
    {
      name: 'Fair Credit Billing Act',
      description: 'Provides chargeback rights for unauthorized post-cancellation charges. Disputes must be filed within 60 days of the billing statement.',
    },
  ],
  proTip:
    'FCC complaints are uniquely effective for telecom disputes. When you file a complaint at consumercomplaints.fcc.gov, the FCC forwards it directly to the company\u2019s executive office (not regular customer service) and the company is required to respond within 30 days. Mentioning your intent to file an FCC complaint in Email 2 often resolves the issue before you need to actually file.',
  otherVerticals: [
    { slug: 'gym', name: 'Gym Memberships' },
    { slug: 'saas', name: 'SaaS & Software' },
    { slug: 'streaming', name: 'Streaming Services' },
    { slug: 'mobile-app', name: 'Mobile App Subscriptions' },
  ],
};

export default function CancelTelecomPage() {
  return <VerticalCancelPage data={DATA} />;
}
