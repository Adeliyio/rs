import type { Metadata } from 'next';
import { VerticalCancelPage } from '@/components/marketing/vertical-cancel-page';
import type { VerticalPageData } from '@/components/marketing/vertical-cancel-page';

export const metadata: Metadata = {
  title: 'Cancel Your Software Subscription — Free Email Generator',
  description:
    'Generate a free 3-step cancellation email sequence for SaaS and software subscriptions. Cites ROSCA and state auto-renewal laws. Works for Adobe, Microsoft 365, Norton, McAfee, and more.',
  openGraph: {
    title: 'Cancel SaaS Subscription — Free | Resolvaio',
    description:
      'Stop paying for software you don\u2019t use. Free cancellation emails citing ROSCA and state auto-renewal statutes.',
  },
};

const DATA: VerticalPageData = {
  slug: 'saas',
  displayName: 'SaaS & Software',
  heroHeadline: 'Cancel your software subscription.',
  heroSubheadline: 'No more hidden auto-renewals.',
  heroParagraph:
    'SaaS companies bury cancellation buttons, auto-renew annual plans without clear notice, and require support tickets to leave. Our free tool generates a 3-step email sequence citing ROSCA and your state\u2019s auto-renewal law \u2014 including the provision that may make non-compliant auto-renewals voidable.',
  companies: [
    'Adobe', 'Microsoft 365', 'Salesforce', 'Slack',
    'Zoom', 'Dropbox', 'Norton / LifeLock', 'McAfee',
    'Grammarly', 'LinkedIn Premium',
  ],
  barriers: [
    {
      barrier: 'Annual plan auto-renewed without clear notice',
      resolution: 'State auto-renewal laws require clear advance notice before charging. In California, non-compliant auto-renewals may be deemed an \u201cunconditional gift\u201d under Bus. & Prof. Code \u00A717603 \u2014 meaning you may be entitled to a full refund.',
    },
    {
      barrier: 'Cancel button buried or missing',
      resolution: 'The FTC Click-to-Cancel rule requires companies to make cancellation as easy as sign-up. If you subscribed online, they must provide a simple online cancellation path.',
    },
    {
      barrier: 'Requires contacting support to cancel',
      resolution: 'A formal email citing consumer protection law creates a documented paper trail and puts the company on notice of their obligations. No hold queue, no chat bot.',
    },
    {
      barrier: 'No pro-rata refund for unused months',
      resolution: 'If the auto-renewal was non-compliant with state law, you may have grounds to request a refund for the entire renewal period, not just the remaining months.',
    },
    {
      barrier: 'Claims data will be lost upon cancellation',
      resolution: 'Email 1 requests data export before cancellation takes effect. Many SaaS providers are required to offer data portability under GDPR/CCPA if applicable.',
    },
    {
      barrier: 'Charges continue after cancellation',
      resolution: 'Post-cancellation charges are disputable under the FCBA. The escalation emails reference chargeback rights and FTC/CFPB complaint filing.',
    },
  ],
  email1Summary:
    'Cites ROSCA and state auto-renewal law (e.g., California\u2019s ARL \u00A717602). Identifies your account, revokes payment authorization, requests data export, and demands written confirmation of cancellation and auto-renewal disabling within 7 business days.',
  email2Summary:
    'References your first email by date. Notes the lack of response or continued charges. Names the FTC and state Attorney General as complaint targets. Mentions FCBA chargeback rights for any post-cancellation charges.',
  email3Summary:
    'Final notice referencing both previous emails. Provides FTC and CFPB complaint URLs. If in California, cites the \u201cunconditional gift\u201d provision for non-compliant auto-renewals. States intent to dispute all charges.',
  laws: [
    {
      name: 'ROSCA / FTC Click-to-Cancel Rule',
      description: 'Federal law requiring simple cancellation for online subscriptions. Companies must make it as easy to cancel as it was to subscribe.',
    },
    {
      name: 'California Auto-Renewal Law (ARL)',
      description: 'Bus. & Prof. Code \u00A717602-17603 requires clear disclosure of auto-renewal terms and a simple cancellation mechanism. Non-compliant auto-renewals may be deemed an \u201cunconditional gift.\u201d',
    },
    {
      name: 'New York GBL \u00A7527-a',
      description: 'Requires businesses to provide clear auto-renewal disclosures and a simple cancellation mechanism. Applies to any SaaS subscription sold to New York consumers.',
    },
    {
      name: 'Fair Credit Billing Act',
      description: 'Provides chargeback rights for unauthorized post-cancellation charges. File disputes with your credit card issuer within 60 days.',
    },
  ],
  proTip:
    'If your SaaS subscription auto-renewed for another year without clear advance notice, California\u2019s ARL has an unusually strong provision: Bus. & Prof. Code \u00A717603 says that goods or services provided in violation of the auto-renewal disclosure requirements are deemed an \u201cunconditional gift\u201d to the consumer. This means you may be able to keep using the service for the paid period while also getting a refund. Not all states have this, but it\u2019s worth citing if you\u2019re in California.',
  otherVerticals: [
    { slug: 'gym', name: 'Gym Memberships' },
    { slug: 'telecom', name: 'Telecom & Cable' },
    { slug: 'streaming', name: 'Streaming Services' },
    { slug: 'mobile-app', name: 'Mobile App Subscriptions' },
  ],
};

export default function CancelSaasPage() {
  return <VerticalCancelPage data={DATA} />;
}
