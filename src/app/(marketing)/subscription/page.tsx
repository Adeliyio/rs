import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Mail, Shield, Zap } from 'lucide-react';
import { safeJsonLd } from '@/lib/safe-json-ld';

export const metadata: Metadata = {
  title: 'Subscription Cancellation — Free for All 50 US States',
  description:
    'Cancel unwanted subscriptions with a 3-step email sequence grounded in US consumer protection law. ROSCA, FCBA, and state-specific statutes. Gyms, telecom, SaaS, streaming. Free.',
  openGraph: {
    title: 'Subscription Cancellation | Resolvaio',
    description:
      'Draft cancellation emails citing ROSCA and state consumer protection law. Free for all 50 US states.',
  },
  alternates: {
    canonical: 'https://resolvaio.com/subscription',
  },
};

const VERTICALS = [
  { name: 'Gym Memberships', icon: Zap },
  { name: 'Telecom & Cable', icon: Shield },
  { name: 'SaaS & Software', icon: Mail },
  { name: 'Streaming Services', icon: Mail },
  { name: 'Mobile App Subscriptions', icon: Zap },
];

export default function SubscriptionLandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Cancel Unwanted Subscriptions
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
          Generate a 3-step email sequence to cancel memberships and
          subscriptions that make it hard to leave. Grounded in ROSCA, FCBA, and
          your state&apos;s consumer protection law.
        </p>
        <div className="mt-8">
          <Link
            href="/start?wedge=subscription"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Cancel a Subscription — Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-neutral-100 bg-neutral-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-neutral-900">
            How It Works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                <Mail className="h-6 w-6 text-neutral-700" />
              </div>
              <h3 className="mt-4 font-semibold">1. Tell Us the Company</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Select the service type (gym, telecom, SaaS, etc.) and company.
                We know the barriers they use.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                <Shield className="h-6 w-6 text-neutral-700" />
              </div>
              <h3 className="mt-4 font-semibold">
                2. Get a 3-Step Email Sequence
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Escalating emails citing ROSCA and state law. Polite initial
                request, firm follow-up, regulatory complaint notice.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                <Zap className="h-6 w-6 text-neutral-700" />
              </div>
              <h3 className="mt-4 font-semibold">3. Copy, Send, Track</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Copy each email and send it. We remind you when to send the
                next step and track the outcome.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Covered verticals */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-neutral-900">
            Industries We Cover
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VERTICALS.map((v) => (
              <div
                key={v.name}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3"
              >
                <v.icon className="h-5 w-5 text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700">
                  {v.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Legal basis */}
      <section className="border-t border-neutral-100 bg-neutral-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-2xl font-bold text-neutral-900">Legal Basis</h2>
          <div className="mt-6 space-y-4 text-neutral-600">
            <p>
              <strong>ROSCA (Restore Online Shoppers&apos; Confidence Act):</strong>{' '}
              Federal law requiring clear disclosure and simple cancellation for
              online subscriptions.
            </p>
            <p>
              <strong>FCBA (Fair Credit Billing Act):</strong>{' '}
              Provides chargeback rights within 60 days for unauthorized
              post-cancellation charges.
            </p>
            <p>
              <strong>State laws:</strong>{' '}
              California ARL (AB 2863), New York GBL §349 (FAIR Act), and
              other state consumer protection statutes where available.
            </p>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            This is general information about these statutes. Verify current law
            with official sources.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          Ready to Cancel?
        </h2>
        <p className="mt-2 text-neutral-600">
          Free for all US states. No payment required.
        </p>
        <div className="mt-6">
          <Link
            href="/start?wedge=subscription"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Subscription Cancellation',
            description:
              'Generate cancellation email sequences grounded in ROSCA and state consumer protection law.',
            provider: {
              '@type': 'Organization',
              name: 'Resolvaio',
              url: 'https://resolvaio.com',
            },
            areaServed: {
              '@type': 'Country',
              name: 'United States',
            },
            serviceType: 'Writing Assistance',
          }),
        }}
      />

      {/* Disclaimer */}
      <footer className="border-t border-neutral-100 py-8">
        <p className="mx-auto max-w-2xl px-6 text-center text-xs text-neutral-500">
          Resolvaio is a writing assistance tool. It does not provide legal
          advice, does not evaluate cases, and does not guarantee outcomes.
          Generated emails should be reviewed before use. Consider consulting a
          licensed attorney for advice about your specific situation.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 px-6 text-xs text-neutral-400">
          <Link href="/legal/terms" className="transition-colors hover:text-neutral-700">Terms</Link>
          <Link href="/legal/privacy" className="transition-colors hover:text-neutral-700">Privacy</Link>
          <Link href="/legal/cookies" className="transition-colors hover:text-neutral-700">Cookies</Link>
          <Link href="/legal/acceptable-use" className="transition-colors hover:text-neutral-700">Acceptable Use</Link>
          <Link href="/legal/ai-disclosure" className="transition-colors hover:text-neutral-700">AI Disclosure</Link>
          <Link href="/legal/accessibility" className="transition-colors hover:text-neutral-700">Accessibility</Link>
        </div>
        <p className="mt-4 text-center text-xs text-neutral-400">
          &copy; {new Date().getFullYear()} Resolvaio. All rights reserved.
          Resolvaio is owned and operated by Nikola Innovations Limited.
        </p>
      </footer>
    </main>
  );
}
