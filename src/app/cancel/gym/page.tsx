import type { Metadata } from 'next';
import { VerticalCancelPage } from '@/components/marketing/vertical-cancel-page';
import type { VerticalPageData } from '@/components/marketing/vertical-cancel-page';

export const metadata: Metadata = {
  title: 'Cancel Your Gym Membership — Free Email Generator',
  description:
    'Generate a free 3-step cancellation email sequence for your gym membership. Cites ROSCA, state health club laws, and auto-renewal statutes. Works for Planet Fitness, LA Fitness, Equinox, and more.',
  openGraph: {
    title: 'Cancel Your Gym Membership — Free | Resolvaio',
    description:
      'Stop paying for a gym you don\u2019t use. Generate free cancellation emails citing the specific law that applies.',
  },
};

const DATA: VerticalPageData = {
  slug: 'gym',
  displayName: 'Gym Membership',
  heroHeadline: 'Cancel your gym membership.',
  heroSubheadline: 'Cite the law they hope you don\u2019t know.',
  heroParagraph:
    'Gyms make cancellation deliberately difficult \u2014 requiring certified letters, in-person visits, or 30-day advance notice. Our free tool generates a 3-step email sequence citing ROSCA, your state\u2019s health club law, and the specific auto-renewal statute that applies to your situation.',
  companies: [
    'Planet Fitness', 'LA Fitness', 'Gold\u2019s Gym', 'Equinox',
    '24 Hour Fitness', 'Anytime Fitness', 'Orangetheory', 'F45',
    'YMCA', 'CrossFit',
  ],
  barriers: [
    {
      barrier: 'Requires a certified letter to cancel',
      resolution: 'If you signed up online or digitally, the FTC Click-to-Cancel rule and state auto-renewal laws (like California\u2019s ARL) may require them to let you cancel online. The email cites this.',
    },
    {
      barrier: 'Requires an in-person visit',
      resolution: 'State health club laws in CA, NY, TX, and FL have specific provisions about cancellation methods. If the contract doesn\u2019t clearly disclose the in-person requirement, it may not be enforceable.',
    },
    {
      barrier: 'Claims you\u2019re in a commitment period',
      resolution: 'If you\u2019re past the minimum commitment, no cancellation fee applies. The email states this explicitly. If the commitment was auto-renewed without clear notice, state law may void it.',
    },
    {
      barrier: 'Charges a cancellation fee',
      resolution: 'Many state health club acts limit or prohibit cancellation fees in certain circumstances (disability, relocation, facility closure). The email references the applicable state provision.',
    },
    {
      barrier: 'Keeps charging after you cancelled',
      resolution: 'Post-cancellation charges are disputable under the Fair Credit Billing Act. Email 2 references FCBA chargeback rights. Email 3 names the FTC and CFPB complaint processes.',
    },
    {
      barrier: 'Auto-renewed for another year without notice',
      resolution: 'Auto-renewal without clear advance notice may violate ROSCA and state auto-renewal laws. In California, non-compliant auto-renewals may be deemed an \u201cunconditional gift\u201d under Bus. & Prof. Code \u00A717603.',
    },
  ],
  email1Summary:
    'Cites ROSCA and your state\u2019s health club law (e.g., Cal. Civ. Code \u00A71812.80 in CA, Tex. Occ. Code \u00A7702 in TX). Identifies your account, revokes payment authorization, and requests written confirmation within 7 business days.',
  email2Summary:
    'References your first email by date. Notes the lack of response. Names the state Attorney General\u2019s consumer protection division and the FTC as complaint targets. Mentions Fair Credit Billing Act chargeback rights.',
  email3Summary:
    'Final notice referencing both previous emails. Provides the FTC complaint URL (ftc.gov/complaint) and CFPB URL. States that all post-cancellation charges will be disputed with the credit card issuer.',
  laws: [
    {
      name: 'ROSCA / FTC Negative Option Rule',
      description: 'Federal law requiring sellers to provide simple cancellation mechanisms for recurring charges. Online sign-ups generally require an online cancellation path.',
    },
    {
      name: 'State Health Club Acts',
      description: 'CA (\u00A71812.80), NY (\u00A7620-627), TX (Occ. Code \u00A7702), and FL (\u00A7501.012) have specific protections for gym members including cooling-off periods, disability cancellation rights, and facility closure refunds.',
    },
    {
      name: 'State Auto-Renewal Laws',
      description: 'California\u2019s ARL (Bus. & Prof. Code \u00A717602) and New York\u2019s GBL \u00A7527-a require clear disclosure of auto-renewal terms before charging. Non-compliant renewals may be voidable.',
    },
    {
      name: 'Fair Credit Billing Act',
      description: 'Provides chargeback rights for unauthorized charges including charges made after a cancellation request. Disputes must be filed within 60 days of the billing statement.',
    },
  ],
  proTip:
    'Many gym contracts have a \u201ccooling-off period\u201d \u2014 typically 3-5 business days after signing \u2014 during which you can cancel for any reason with a full refund. After that window, check whether you\u2019re past your minimum commitment period. If you are, no cancellation fee should apply regardless of what the retention department tells you.',
  otherVerticals: [
    { slug: 'telecom', name: 'Telecom & Cable' },
    { slug: 'saas', name: 'SaaS & Software' },
    { slug: 'streaming', name: 'Streaming Services' },
    { slug: 'mobile-app', name: 'Mobile App Subscriptions' },
  ],
};

export default function CancelGymPage() {
  return <VerticalCancelPage data={DATA} />;
}
