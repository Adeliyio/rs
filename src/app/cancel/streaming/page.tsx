import type { Metadata } from 'next';
import { VerticalCancelPage } from '@/components/marketing/vertical-cancel-page';
import type { VerticalPageData } from '@/components/marketing/vertical-cancel-page';

export const metadata: Metadata = {
  title: 'Cancel Your Streaming Subscription — Free Email Generator',
  description:
    'Generate a free 3-step cancellation email sequence for streaming services. Cites ROSCA and state consumer protection law. Works for Netflix, Hulu, Spotify, Disney+, and more.',
  openGraph: {
    title: 'Cancel Streaming Subscription — Free | Resolvaio',
    description:
      'Stop paying for streaming services you don\u2019t watch. Free cancellation emails citing federal consumer protection law.',
  },
};

const DATA: VerticalPageData = {
  slug: 'streaming',
  displayName: 'Streaming Services',
  heroHeadline: 'Cancel your streaming subscription.',
  heroSubheadline: 'Even the ones that make it confusing.',
  heroParagraph:
    'Most streaming cancellations are straightforward \u2014 until they aren\u2019t. Free trials that silently convert to paid subscriptions, annual plans with no refund, and charges that continue after you thought you cancelled. Our free tool generates a 3-step email sequence citing ROSCA and your state\u2019s auto-renewal law.',
  companies: [
    'Netflix', 'Hulu', 'Disney+', 'HBO Max',
    'Paramount+', 'Peacock', 'Apple TV+', 'Amazon Prime Video',
    'Spotify', 'YouTube Premium', 'Audible',
  ],
  barriers: [
    {
      barrier: 'Free trial converted to paid without clear notice',
      resolution: 'ROSCA and state auto-renewal laws require clear disclosure before converting a free trial to a paid subscription. California\u2019s ARL (\u00A717602(c)) specifically addresses free-trial-to-paid conversion notice requirements.',
    },
    {
      barrier: 'Annual plan with no prorated refund',
      resolution: 'If the auto-renewal was not clearly disclosed in advance, the charge may be voidable under state law. The email cites the specific auto-renewal statute.',
    },
    {
      barrier: 'Charged after cancellation',
      resolution: 'Post-cancellation charges are disputable under the Fair Credit Billing Act. The escalation emails reference chargeback rights and regulatory complaint options.',
    },
    {
      barrier: 'Subscribed through App Store or Google Play',
      resolution: 'If you subscribed through Apple or Google, the subscription must be cancelled through the platform \u2014 not the streaming service. The email addresses the streaming company while noting the platform cancellation path.',
    },
  ],
  email1Summary:
    'Cites ROSCA and the free-trial-to-paid conversion notice requirement if applicable. Identifies your account, revokes payment authorization, and requests written confirmation of cancellation within 7 business days.',
  email2Summary:
    'References your first email by date. Notes the lack of response. Mentions FTC and state AG complaint options. References FCBA chargeback rights for post-cancellation charges.',
  email3Summary:
    'Final notice with specific FTC and CFPB complaint filing URLs. States intent to dispute all unauthorized charges. Requests immediate confirmation.',
  laws: [
    {
      name: 'ROSCA / FTC Negative Option Rule',
      description: 'Federal law requiring clear disclosure of recurring charges and a simple cancellation mechanism. Applies to all streaming services that charge automatically.',
    },
    {
      name: 'Free-Trial Conversion Rules',
      description: 'California\u2019s ARL (\u00A717602(c)) and similar state laws require specific advance notice before converting a free trial to a paid subscription. Failure to provide notice may void the charge.',
    },
    {
      name: 'State Auto-Renewal Laws',
      description: 'California (ARL), New York (GBL \u00A7527-a), and other states require clear auto-renewal disclosures. Non-compliant renewals may be voidable.',
    },
    {
      name: 'Fair Credit Billing Act',
      description: 'Provides chargeback rights for unauthorized charges. Disputes must be filed within 60 days of the billing statement.',
    },
  ],
  proTip:
    'If you subscribed to a streaming service through the Apple App Store or Google Play Store, you must cancel through the platform, not the streaming service itself. On iOS: Settings \u2192 [Your Name] \u2192 Subscriptions. On Android: Play Store \u2192 Menu \u2192 Subscriptions. Deleting the app does NOT cancel the subscription. For refunds, use reportaproblem.apple.com (Apple) or play.google.com/store/account/subscriptions (Google).',
  otherVerticals: [
    { slug: 'gym', name: 'Gym Memberships' },
    { slug: 'telecom', name: 'Telecom & Cable' },
    { slug: 'saas', name: 'SaaS & Software' },
    { slug: 'mobile-app', name: 'Mobile App Subscriptions' },
  ],
};

export default function CancelStreamingPage() {
  return <VerticalCancelPage data={DATA} />;
}
