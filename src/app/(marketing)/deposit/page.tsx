import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, FileText, Scale, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Security Deposit Recovery — California, Texas, New York, Florida',
  description:
    'Get your security deposit back with a professionally drafted demand letter grounded in your state\'s landlord-tenant law. Covers CA, TX, NY, FL. Verified statute citations.',
  openGraph: {
    title: 'Security Deposit Recovery | Resolvaio',
    description:
      'Draft a demand letter grounded in verified US statutes for your state. Writing assistance, not legal advice.',
  },
  alternates: {
    canonical: 'https://resolvaio.com/deposit',
  },
};

const STATES = [
  { code: 'CA', name: 'California', slug: 'california', deadline: '21 days' },
  { code: 'TX', name: 'Texas', slug: 'texas', deadline: '30 days' },
  { code: 'NY', name: 'New York', slug: 'new-york', deadline: '14 days' },
  { code: 'FL', name: 'Florida', slug: 'florida', deadline: '15-30 days' },
];

export default function DepositLandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Get Your Security Deposit Back
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
          Answer a few questions about your situation and receive a demand letter
          grounded in your state&apos;s landlord-tenant statutes. Cited,
          validated, and ready to send via certified mail.
        </p>
        <div className="mt-8">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Start Your Letter
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
                <FileText className="h-6 w-6 text-neutral-700" />
              </div>
              <h3 className="mt-4 font-semibold">1. Answer Questions</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Tell us about your move-out date, deposit amount, and what was
                withheld. Takes about 5 minutes.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                <Scale className="h-6 w-6 text-neutral-700" />
              </div>
              <h3 className="mt-4 font-semibold">2. We Draft Your Letter</h3>
              <p className="mt-2 text-sm text-neutral-600">
                AI generates a demand letter citing the exact statutes that apply
                to your jurisdiction. Every citation is validated.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                <Shield className="h-6 w-6 text-neutral-700" />
              </div>
              <h3 className="mt-4 font-semibold">3. Send via Certified Mail</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Print, sign, and send. We guide you through USPS Certified Mail
                and track statutory deadlines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* State coverage */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold text-neutral-900">
            Available States
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {STATES.map((state) => (
              <Link
                key={state.code}
                href={`/deposit/${state.slug}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-5 py-4 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
              >
                <div>
                  <h3 className="font-semibold text-neutral-900">
                    {state.name}
                  </h3>
                  <p className="text-sm text-neutral-500">
                    Deposit return deadline: {state.deadline}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <footer className="border-t border-neutral-100 py-8">
        <p className="mx-auto max-w-2xl px-6 text-center text-xs text-neutral-500">
          Resolvaio is a writing assistance tool. It does not provide legal
          advice, does not evaluate cases, and does not guarantee outcomes.
          Generated letters should be reviewed before use. Consider consulting a
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
