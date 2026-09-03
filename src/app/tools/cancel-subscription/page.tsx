import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Mail,
  AlertTriangle,
  Shield,
  Scale,
  Copy,
  X,
} from 'lucide-react';
import { ToolsDropdown } from '@/components/marketing/tools-dropdown';
import { safeJsonLd } from '@/lib/safe-json-ld';
import { Logo } from '@/components/logo';

/* ------------------------------------------------------------------ */
/*  Metadata                                                          */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: 'Free Subscription Cancellation Email Generator',
  description:
    'Generate a free 3-step cancellation email sequence backed by ROSCA and state consumer protection law. Works for gyms, telecom, SaaS, streaming, and mobile apps. All 50 US states.',
  openGraph: {
    title: 'Free Subscription Cancellation Email Generator | Resolvaio',
    description:
      'Draft cancellation emails citing the specific federal and state law that applies to your situation. Free. No card required.',
  },
};

/* ------------------------------------------------------------------ */
/*  Data                                                              */
/* ------------------------------------------------------------------ */

const VERTICALS = [
  {
    name: 'Gym Memberships',
    slug: 'gym',
    examples: 'Planet Fitness, LA Fitness, Anytime Fitness, Equinox',
    barrier: 'Require in-person cancellation, freeze periods, annual commitments',
  },
  {
    name: 'Telecom & Cable',
    slug: 'telecom',
    examples: 'Comcast, AT&T, Spectrum, Verizon',
    barrier: 'Early termination fees, bundled contracts, retention departments',
  },
  {
    name: 'SaaS & Software',
    slug: 'saas',
    examples: 'Adobe, Salesforce, Grammarly, McAfee',
    barrier: 'Auto-renewal buried in terms, no visible cancel button',
  },
  {
    name: 'Streaming Services',
    slug: 'streaming',
    examples: 'Netflix, Hulu, Spotify, YouTube Premium',
    barrier: 'Auto-renewed without clear notice, difficult refund process',
  },
  {
    name: 'Mobile App Subscriptions',
    slug: 'mobile-app',
    examples: 'Dating apps, fitness trackers, cloud storage, news paywalls',
    barrier: 'Charged through App Store/Play Store, confusing unsubscribe process',
  },
];

const COMPARISON = [
  {
    feature: 'What it generates',
    generic: 'A single polite "please cancel" email',
    resolvaio: 'A 3-step escalation sequence (Day 0, 7, 14)',
  },
  {
    feature: 'Legal citations',
    generic: 'None',
    resolvaio: 'ROSCA, FCBA, and state-specific statutes',
  },
  {
    feature: 'Charge revocation',
    generic: 'Not mentioned',
    resolvaio: 'Explicit revocation of payment authorization',
  },
  {
    feature: 'Regulatory escalation',
    generic: 'Not included',
    resolvaio: 'FTC and CFPB complaint references with filing URLs',
  },
  {
    feature: 'Chargeback rights',
    generic: 'Not mentioned',
    resolvaio: 'Fair Credit Billing Act dispute rights cited',
  },
  {
    feature: 'Personalization',
    generic: 'Fill in the blanks',
    resolvaio: 'Pre-filled with your account, company, and situation details',
  },
  {
    feature: 'Cost',
    generic: 'Free',
    resolvaio: 'Free',
  },
];

const FAQS = [
  {
    q: 'Is this really free?',
    a: 'Yes. Subscription cancellation is free with no card required. We generate all three emails at no cost. Our revenue comes from a separate paid product for security deposit recovery — subscription cancellation is free because it helps people and builds trust.',
  },
  {
    q: 'Do you send the emails for me?',
    a: 'No. We generate the emails and you send them from your own email account. This is better for you — emails from your personal address are more credible to companies than emails from a third-party service. We provide a copy button and an "Open in email" button that pre-fills your email client.',
  },
  {
    q: 'What law does it cite?',
    a: 'Federally, the emails cite the Restore Online Shoppers\u2019 Confidence Act (ROSCA) and the FTC Negative Option Rule, which require companies to provide simple cancellation mechanisms. For chargeback rights, we cite the Fair Credit Billing Act (FCBA). In states with specific auto-renewal laws (like California\u2019s ARL or New York\u2019s GBL \u00A7 527-a), we include those too.',
  },
  {
    q: 'Will this work for my specific company?',
    a: 'The emails are grounded in federal consumer protection law that applies to all subscription services in the US. We customize them for your specific company, account details, and situation. Most companies process clearly stated cancellation requests that cite applicable law, but some resist — that is what the follow-up and escalation emails are for.',
  },
  {
    q: 'Is this legal advice?',
    a: 'No. Resolvaio is a writing assistance tool. It generates emails based on generally applicable consumer protection statutes. It does not evaluate your specific claim, predict outcomes, or recommend a course of action. Review all content before sending.',
  },
  {
    q: 'Why three emails?',
    a: 'One email is easy to ignore. The 3-step sequence escalates: Email 1 is a formal request citing the law. Email 2 follows up after 7 days and names the regulatory agency you can complain to. Email 3 is a final notice referencing FTC and CFPB complaint processes plus credit card dispute rights. Each step increases the cost of ignoring you.',
  },
  {
    q: 'What if I\u2019ve already tried to cancel?',
    a: 'Even better. The diagnostic asks about your previous cancellation attempts — when, how, and what happened. The generated emails reference your prior attempt by date and method, which strengthens the request and establishes a pattern of the company making cancellation difficult.',
  },
  {
    q: 'What happens after I send all three emails?',
    a: 'If the company still hasn\u2019t cancelled, the third email provides specific URLs to file complaints with the FTC (ftc.gov/complaint) and CFPB (consumerfinance.gov/complaint). You can also dispute post-cancellation charges with your credit card issuer under the Fair Credit Billing Act.',
  },
];

/* ------------------------------------------------------------------ */
/*  Sample email — shown as social proof                              */
/* ------------------------------------------------------------------ */

const SAMPLE_EMAIL = `Dear [Company Name],

I am writing to formally request the immediate cancellation of my subscription (Account: [Account ID]).

Under the Restore Online Shoppers' Confidence Act (ROSCA), 16 CFR Part 425, sellers offering negative option features must provide a simple mechanism for consumers to stop recurring charges. I am exercising that right and revoking authorization for any future charges to my payment method effective immediately.

I request written confirmation within 7 business days that:
1. My subscription has been cancelled
2. Auto-renewal has been disabled
3. No further charges will be made to my payment method on file

Thank you for your prompt attention to this matter.

Sincerely,
[Your Name]
[Date]`;

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function CancelSubscriptionToolPage(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-background">
      {/* ============================================================ */}
      {/*  NAV                                                         */}
      {/* ============================================================ */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" aria-label="Resolvaio home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-8 text-[13px] sm:flex">
            <ToolsDropdown />
            <a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">How It Works</a>
            <a href="#sample" className="text-muted-foreground transition-colors hover:text-foreground">Sample</a>
            <Link href="/blog" className="text-muted-foreground transition-colors hover:text-foreground">Blog</Link>
            <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">Sign In</Link>
            <Link
              href="/start?wedge=subscription"
              className="rounded-lg bg-foreground px-4 py-2 font-medium text-white transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              Generate Free Emails
            </Link>
          </div>
          <Link
            href="/start?wedge=subscription"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-all hover:bg-foreground/90 active:scale-[0.98] sm:hidden"
          >
            Generate Free Emails
          </Link>
        </div>
      </nav>

      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section className="px-6 py-24 text-center sm:py-32">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-1.5 text-[13px] font-medium text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            100% free. No card required. All 50 states.
          </div>
          <h1 className="text-[42px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[56px]">
            Cancel any subscription.
            <br />
            <span className="text-muted-foreground">Cite the law they&apos;re ignoring.</span>
          </h1>
          <p className="mt-8 text-[16px] leading-[1.7] text-muted-foreground">
            Generate a free 3-step cancellation email sequence grounded in ROSCA,
            the Fair Credit Billing Act, and your state&apos;s consumer protection
            statutes. Not a polite request &mdash; a documented demand citing the
            specific law that applies.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/start?wedge=subscription"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-8 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              Generate Your Free Emails <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#sample"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              See a sample email <ChevronRight className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-6 text-[12px] text-muted-foreground">
            Writing assistance grounded in verified law. Not legal advice. Not a law firm.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                */}
      {/* ============================================================ */}
      <section id="how-it-works" className="border-t border-border bg-white px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
            How It Works
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Five minutes to three ready-to-send emails.
          </h2>
          <div className="grid gap-10 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-[14px] font-semibold text-white">
                1
              </div>
              <h3 className="mt-5 text-[16px] font-semibold text-foreground">
                Tell us about the subscription
              </h3>
              <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
                Company name, account ID, what you&apos;re being charged,
                and what happened when you tried to cancel. Takes about
                5 minutes.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-[14px] font-semibold text-white">
                2
              </div>
              <h3 className="mt-5 text-[16px] font-semibold text-foreground">
                Get your 3-email sequence
              </h3>
              <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
                Three escalating emails &mdash; each citing the specific
                federal and state law that applies. Day 0 formal request,
                Day 7 follow-up, Day 14 final notice with regulatory
                complaint references.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-[14px] font-semibold text-white">
                3
              </div>
              <h3 className="mt-5 text-[16px] font-semibold text-foreground">
                Copy, send, escalate
              </h3>
              <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
                Copy each email and send it from your personal email account.
                If they still haven&apos;t cancelled after Email 3, you
                have the FTC and CFPB filing URLs and credit card dispute
                guidance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SAMPLE EMAIL                                                */}
      {/* ============================================================ */}
      <section id="sample" className="border-t border-border px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
            Sample Output
          </p>
          <h2 className="mb-4 text-center text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            This is what a generic cancellation email looks like.
            <br />
            <span className="text-muted-foreground">And this is what ours looks like.</span>
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[15px] leading-[1.7] text-muted-foreground">
            Most cancellation emails are polite requests that companies file
            in the trash. Ours cite the specific law they&apos;re required to comply with.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Generic */}
            <div className="rounded-2xl border border-red-200/60 bg-red-50/40 p-8">
              <div className="mb-5 flex items-center gap-2.5">
                <X className="h-5 w-5 text-red-500" />
                <span className="text-[14px] font-semibold text-red-700">Generic Template</span>
              </div>
              <div className="font-serif text-[14px] italic leading-[1.8] text-muted-foreground">
                &ldquo;Dear Customer Service,
                <br /><br />
                I would like to cancel my subscription. Please process
                this request and confirm the cancellation.
                <br /><br />
                Thank you.&rdquo;
              </div>
              <p className="mt-5 text-[12px] leading-relaxed text-red-600/80">
                No statute. No account identifier. No charge revocation. No deadline.
                No escalation path. Easy to ignore.
              </p>
            </div>

            {/* Resolvaio */}
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-8">
              <div className="mb-5 flex items-center gap-2.5">
                <Check className="h-5 w-5 text-emerald-600" />
                <span className="text-[14px] font-semibold text-emerald-700">Resolvaio (Email 1 of 3)</span>
              </div>
              <div className="font-serif text-[14px] italic leading-[1.8] text-muted-foreground">
                &ldquo;Under the Restore Online Shoppers&apos; Confidence Act
                (ROSCA), 16 CFR Part 425, sellers offering negative option
                features must provide a simple mechanism for consumers to
                stop recurring charges. I am revoking authorization for any
                future charges to my payment method effective immediately.
                <br /><br />
                I request written confirmation within 7 business days that
                my subscription has been cancelled, auto-renewal has been
                disabled, and no further charges will be made.&rdquo;
              </div>
              <p className="mt-5 text-[12px] leading-relaxed text-emerald-700/80">
                Specific statute. Account identified. Charges revoked. Deadline set.
                Confirmation demanded. Two more emails follow if ignored.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  THE SEQUENCE                                                */}
      {/* ============================================================ */}
      <section className="border-t border-border bg-white px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
            The Sequence
          </p>
          <h2 className="mb-4 text-center text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Three emails. Escalating pressure. All free.
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[15px] leading-[1.7] text-muted-foreground">
            Each email builds on the last. If the company ignores your first
            request, the follow-ups name regulatory agencies and credit card
            dispute rights. The cost of ignoring you goes up with each step.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Day 0
                </span>
              </div>
              <h3 className="mb-2 text-[16px] font-semibold text-foreground">
                Formal Cancellation Demand
              </h3>
              <p className="text-[14px] leading-[1.7] text-muted-foreground">
                Cites ROSCA and your state&apos;s auto-renewal law. Revokes
                payment authorization. Requests written confirmation within
                7 business days.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Day 7
                </span>
              </div>
              <h3 className="mb-2 text-[16px] font-semibold text-foreground">
                Follow-Up with Escalation
              </h3>
              <p className="text-[14px] leading-[1.7] text-muted-foreground">
                References your first email by date. Names the specific
                regulatory agency. Mentions Fair Credit Billing Act
                chargeback rights.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Day 14
                </span>
              </div>
              <h3 className="mb-2 text-[16px] font-semibold text-foreground">
                Final Notice
              </h3>
              <p className="text-[14px] leading-[1.7] text-muted-foreground">
                Provides FTC and CFPB complaint filing URLs. States that
                all post-cancellation charges will be disputed with credit
                card issuer. Final deadline.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FULL SAMPLE EMAIL PREVIEW                                   */}
      {/* ============================================================ */}
      <section className="border-t border-border px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
            Full Preview
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Here&apos;s what Email 1 looks like.
          </h2>

          <div className="rounded-2xl border border-border bg-white">
            {/* Email header */}
            <div className="border-b border-border px-8 py-5">
              <p className="text-[12px] text-muted-foreground">Subject:</p>
              <p className="mt-1 text-[15px] font-semibold text-foreground">
                Formal Request to Cancel Subscription — [Account ID]
              </p>
            </div>
            {/* Email body */}
            <div className="px-8 py-6">
              <pre className="whitespace-pre-wrap font-sans text-[14px] leading-[1.8] text-muted-foreground">
                {SAMPLE_EMAIL}
              </pre>
            </div>
            {/* Footer note */}
            <div className="border-t border-border px-8 py-4">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Copy className="h-3.5 w-3.5" />
                Your actual email will be personalized with your name, email, company,
                account details, and the specific statutes for your state.
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/start?wedge=subscription"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-8 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              Generate Yours Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  COMPARISON                                                  */}
      {/* ============================================================ */}
      <section className="border-t border-border bg-white px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
            Why This Is Different
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Generic templates vs. Resolvaio.
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-4 text-left font-medium text-muted-foreground"></th>
                  <th className="p-4 text-left font-medium text-muted-foreground">Generic Templates</th>
                  <th className="p-4 text-left font-semibold text-foreground">Resolvaio</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-4 font-medium text-foreground">{row.feature}</td>
                    <td className="p-4 text-muted-foreground">{row.generic}</td>
                    <td className="p-4 font-medium text-foreground">{row.resolvaio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  VERTICALS                                                   */}
      {/* ============================================================ */}
      <section id="verticals" className="border-t border-border px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
            Industries Covered
          </p>
          <h2 className="mb-4 text-center text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Works for gyms, telecom, SaaS, streaming, and mobile apps.
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[15px] leading-[1.7] text-muted-foreground">
            Each industry has its own cancellation barriers. Our diagnostic
            identifies the specific barriers you&apos;re facing and the emails
            address them directly.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {VERTICALS.map((v) => (
              <Link
                key={v.name}
                href={`/cancel/${v.slug}`}
                className="group rounded-2xl border border-border bg-white p-6 transition-all hover:border-foreground/10 hover:shadow-premium"
              >
                <h3 className="text-[16px] font-semibold text-foreground group-hover:text-primary transition-colors">{v.name}</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">{v.examples}</p>
                <p className="mt-3 text-[14px] leading-[1.7] text-muted-foreground">
                  <span className="font-medium text-foreground">Common barrier:</span>{' '}
                  {v.barrier}
                </p>
                <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Learn more <ChevronRight className="h-3.5 w-3.5" />
                </p>
              </Link>
            ))}
          </div>

          <p className="mt-8 text-center text-[14px] text-muted-foreground">
            Federal baseline (ROSCA) covers all 50 states. State-specific citations
            included for California (ARL), New York (GBL &sect; 527-a), and others
            where available.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  LEGAL BASIS                                                 */}
      {/* ============================================================ */}
      <section className="border-t border-border bg-white px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
            Legal Basis
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Every citation verified. Never invented.
          </h2>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background p-8">
              <Scale className="mb-4 h-6 w-6 text-foreground" />
              <h3 className="mb-2 text-[16px] font-semibold text-foreground">ROSCA</h3>
              <p className="text-[14px] leading-[1.7] text-muted-foreground">
                The Restore Online Shoppers&apos; Confidence Act and the FTC
                Negative Option Rule (16 CFR Part 425) require sellers to
                provide simple cancellation mechanisms and clear disclosure
                of recurring charges.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-8">
              <Shield className="mb-4 h-6 w-6 text-foreground" />
              <h3 className="mb-2 text-[16px] font-semibold text-foreground">Fair Credit Billing Act</h3>
              <p className="text-[14px] leading-[1.7] text-muted-foreground">
                The FCBA provides consumers with chargeback rights for
                unauthorized charges, including charges made after a
                cancellation request. Disputes must be filed within
                60 days of the billing statement.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-8">
              <Clock className="mb-4 h-6 w-6 text-foreground" />
              <h3 className="mb-2 text-[16px] font-semibold text-foreground">State Auto-Renewal Laws</h3>
              <p className="text-[14px] leading-[1.7] text-muted-foreground">
                California&apos;s ARL (AB 2863), New York&apos;s GBL &sect; 527-a,
                and similar state statutes impose additional requirements
                on auto-renewal disclosures and cancellation rights. We
                include state-specific citations where available.
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-[12px] text-muted-foreground">
            This is general information about these statutes, not legal advice.
            Verify current law with official sources.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FAQ                                                         */}
      {/* ============================================================ */}
      <section id="faq" className="border-t border-border px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
            FAQ
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Common questions
          </h2>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border bg-white">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-5 text-[15px] font-semibold text-foreground">
                  {faq.q}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="px-6 pb-5 text-[14px] leading-[1.7] text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FINAL CTA                                                   */}
      {/* ============================================================ */}
      <section className="border-t border-border bg-white px-6 py-24 text-center sm:py-32">
        <div className="mx-auto max-w-xl">
          <h2 className="text-[32px] font-semibold tracking-tight text-foreground sm:text-[40px]">
            Stop asking nicely.
            <br />
            <span className="text-muted-foreground">Cite the law.</span>
          </h2>
          <p className="mt-6 text-[16px] leading-[1.7] text-muted-foreground">
            Companies count on you giving up. A polite request gets ignored.
            A documented demand citing federal consumer protection law gets
            a response. The tool is free. The emails take 5 minutes.
          </p>
          <Link
            href="/start?wedge=subscription"
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-foreground px-8 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-foreground/90 active:scale-[0.98]"
          >
            Generate Your Free Emails <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-6 text-[12px] text-muted-foreground">
            No card required. No signup fee. Takes about 5 minutes.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  ALSO FROM RESOLVAIO                                         */}
      {/* ============================================================ */}
      <section className="border-t border-border px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-8 text-center text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
            Also from Resolvaio
          </p>
          <div className="rounded-2xl border border-border bg-white p-8 sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <h3 className="text-[18px] font-semibold text-foreground">
                Security Deposit Recovery
              </h3>
              <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
                Landlord didn&apos;t return your deposit? Generate a demand letter
                grounded in your state&apos;s landlord-tenant statutes with an
                itemized rebuttal table and escalation packet.
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                CA, TX, NY, FL &middot; $49 per case
              </p>
            </div>
            <Link
              href="/start?wedge=deposit"
              className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-6 py-3 text-[14px] font-semibold text-foreground transition-all hover:border-foreground/20 hover:bg-background active:scale-[0.98] sm:mt-0"
            >
              Learn More <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-border px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link href="/" className="text-[15px] font-semibold text-foreground">
                Resolvaio
              </Link>
              <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                Demand letters and cancellation emails grounded in verified
                consumer protection law. Writing assistance, not legal advice.
              </p>
            </div>
            <div className="flex gap-10 text-[13px] text-muted-foreground">
              <div className="space-y-2.5">
                <p className="font-semibold text-muted-foreground">Tools</p>
                <Link href="/tools/cancel-subscription" className="block transition-colors hover:text-foreground">Cancel Subscription</Link>
                <Link href="/tools/deposit-deadline" className="block transition-colors hover:text-foreground">Deposit Deadline Calculator</Link>
                <Link href="/" className="block transition-colors hover:text-foreground">Home</Link>
              </div>
              <div className="space-y-2.5">
                <p className="font-semibold text-muted-foreground">Account</p>
                <Link href="/start" className="block transition-colors hover:text-foreground">Start Diagnostic</Link>
                <Link href="/login" className="block transition-colors hover:text-foreground">Sign In</Link>
                <Link href="/about" className="block transition-colors hover:text-foreground">About</Link>
              </div>
              <div className="space-y-2.5">
                <p className="font-semibold text-muted-foreground">Legal</p>
                <Link href="/legal/terms" className="block transition-colors hover:text-foreground">Terms of Service</Link>
                <Link href="/legal/privacy" className="block transition-colors hover:text-foreground">Privacy Policy</Link>
                <Link href="/legal/cookies" className="block transition-colors hover:text-foreground">Cookie Policy</Link>
                <Link href="/legal/acceptable-use" className="block transition-colors hover:text-foreground">Acceptable Use</Link>
                <Link href="/legal/ai-disclosure" className="block transition-colors hover:text-foreground">AI Disclosure</Link>
                <Link href="/legal/accessibility" className="block transition-colors hover:text-foreground">Accessibility</Link>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-border pt-8 text-center text-[12px] leading-relaxed text-muted-foreground">
            <p>
              Resolvaio provides writing assistance and general information about
              consumer disputes. It does not provide legal advice, does not
              evaluate claims, and does not guarantee outcomes. Resolvaio is not a
              law firm, is not a substitute for an attorney, and the use of
              Resolvaio does not create an attorney-client relationship. Individual
              results vary. Review all content before sending.
            </p>
            <p className="mt-4">
              &copy; {new Date().getFullYear()} Resolvaio. All rights reserved.
              Resolvaio is owned and operated by Nikola Innovations Limited.
            </p>
          </div>
        </div>
      </footer>

      {/* ============================================================ */}
      {/*  JSON-LD STRUCTURED DATA                                     */}
      {/* ============================================================ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Resolvaio Free Subscription Cancellation Email Generator',
            description:
              'Generate a free 3-step cancellation email sequence backed by ROSCA, FCBA, and state consumer protection law. Works for gyms, telecom, SaaS, streaming, and mobile apps.',
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
            provider: {
              '@type': 'Organization',
              name: 'Resolvaio',
              url: 'https://resolvaio.com',
            },
            areaServed: {
              '@type': 'Country',
              name: 'United States',
            },
          }),
        }}
      />
    </main>
  );
}
