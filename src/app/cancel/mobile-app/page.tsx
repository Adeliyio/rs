import type { Metadata } from 'next';
import { VerticalCancelPage } from '@/components/marketing/vertical-cancel-page';
import type { VerticalPageData } from '@/components/marketing/vertical-cancel-page';

export const metadata: Metadata = {
  title: 'Cancel Your Mobile App Subscription — Free Email Generator',
  description:
    'Generate a free 3-step cancellation email sequence for mobile app subscriptions. Covers App Store, Google Play, and direct-billed subscriptions. Cites ROSCA and state auto-renewal laws.',
  openGraph: {
    title: 'Cancel App Subscription — Free | Resolvaio',
    description:
      'Stop paying for apps you don\u2019t use. Free cancellation emails citing federal consumer protection law. Covers iOS, Android, and direct subscriptions.',
  },
};

const DATA: VerticalPageData = {
  slug: 'mobile-app',
  displayName: 'Mobile App Subscriptions',
  heroHeadline: 'Cancel your app subscription.',
  heroSubheadline: 'Deleting the app doesn\u2019t cancel it.',
  heroParagraph:
    'Mobile app subscriptions are the most confusing to cancel because of the platform middleman. Subscribed through the App Store? You cancel through Apple, not the app. Subscribed directly? You email the developer. Our free tool figures out which path applies and generates the right emails.',
  companies: [
    'Dating apps (Tinder, Bumble, Hinge)',
    'Fitness trackers (Strava, MyFitnessPal)',
    'Cloud storage (iCloud+, Google One)',
    'News paywalls (NYT, WSJ, The Athletic)',
    'Meditation apps (Calm, Headspace)',
    'VPN services (NordVPN, ExpressVPN)',
    'Photo/video editors (VSCO, Facetune)',
    'Language learning (Duolingo, Babbel)',
  ],
  barriers: [
    {
      barrier: 'Deleted the app but still being charged',
      resolution: 'Deleting an app does NOT cancel the subscription. If you subscribed through Apple or Google, the subscription continues until cancelled through the platform\u2019s subscription settings. The email explains this and addresses the right party.',
    },
    {
      barrier: 'Free trial converted to paid',
      resolution: 'ROSCA and state auto-renewal laws require clear disclosure before converting a free trial. If you weren\u2019t clearly notified, the charge may be voidable. The email cites the specific statute.',
    },
    {
      barrier: 'Can\u2019t figure out who to cancel with',
      resolution: 'Our diagnostic determines whether you subscribed through Apple, Google, or directly with the developer. The emails are addressed to the right party with the right cancellation path.',
    },
    {
      barrier: 'Accidental subscription from an in-app prompt',
      resolution: 'Accidental subscriptions \u2014 especially those triggered by misleading in-app prompts \u2014 may qualify for a platform refund. The email requests cancellation and a refund citing the applicable consumer protection law.',
    },
    {
      barrier: 'Charged after requesting cancellation',
      resolution: 'Post-cancellation charges are disputable under the FCBA. For platform-mediated subscriptions, you can also request a refund through Apple\u2019s reportaproblem.apple.com or Google Play\u2019s refund process.',
    },
    {
      barrier: 'Family sharing complicates cancellation',
      resolution: 'For Apple Family Sharing, the subscription must be cancelled by the family organizer. The email addresses this and includes instructions for the right account holder.',
    },
  ],
  email1Summary:
    'Identifies whether the subscription is through Apple, Google, or direct billing. Cites ROSCA and the applicable auto-renewal statute. Revokes payment authorization and requests written confirmation of cancellation and refund (if applicable) within 7 business days.',
  email2Summary:
    'References your first email. Notes continued charges. Mentions the platform refund process as an alternative (reportaproblem.apple.com or Google Play refunds). References FTC complaint option.',
  email3Summary:
    'Final notice with FTC and CFPB complaint URLs. For platform subscriptions, references Apple/Google\u2019s own refund and dispute policies. States intent to dispute all post-cancellation charges.',
  laws: [
    {
      name: 'ROSCA / FTC Click-to-Cancel Rule',
      description: 'Federal law requiring simple cancellation mechanisms. Applies to app developers who bill directly. For platform-mediated subscriptions, Apple and Google have their own cancellation requirements.',
    },
    {
      name: 'State Auto-Renewal Laws',
      description: 'California\u2019s ARL and New York\u2019s GBL \u00A7527-a require clear auto-renewal disclosures before charging. Applies to both direct and platform-mediated subscriptions.',
    },
    {
      name: 'Apple / Google Refund Policies',
      description: 'Apple reviews refund requests at reportaproblem.apple.com (typically within 48 hours). Google offers refunds within 48 hours of purchase; after that, refunds are at the developer\u2019s discretion.',
    },
    {
      name: 'Fair Credit Billing Act',
      description: 'Provides chargeback rights for unauthorized charges. For platform-billed subscriptions, you can also dispute through your credit card issuer.',
    },
  ],
  proTip:
    'The single most important thing to know about mobile app subscriptions: deleting the app does NOT cancel the subscription. You will keep being charged. To cancel on iPhone: Settings \u2192 [Your Name] \u2192 Subscriptions \u2192 select the subscription \u2192 Cancel. To cancel on Android: Google Play Store \u2192 Menu \u2192 Subscriptions \u2192 select \u2192 Cancel. For refunds, use reportaproblem.apple.com (Apple) or play.google.com/store/account/subscriptions (Google). Do this FIRST, then use our emails for anything the platform cancellation doesn\u2019t resolve.',
  otherVerticals: [
    { slug: 'gym', name: 'Gym Memberships' },
    { slug: 'telecom', name: 'Telecom & Cable' },
    { slug: 'saas', name: 'SaaS & Software' },
    { slug: 'streaming', name: 'Streaming Services' },
  ],
};

export default function CancelMobileAppPage() {
  return <VerticalCancelPage data={DATA} />;
}
