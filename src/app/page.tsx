import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Shield,
  FileText,
  Scale,
  Clock,
  ChevronRight,
  Upload,
  AlertTriangle,
  Check,
  X,
  MapPin,
  Mail,
  Download,
} from 'lucide-react';
import { TrustSignals } from '@/components/trust-signals';
import { ToolsDropdown } from '@/components/marketing/tools-dropdown';
import { safeJsonLd } from '@/lib/safe-json-ld';
import { Logo } from '@/components/logo';

/** App subdomain base URL — prevents CORS errors from cross-origin RSC redirects.
 *  In development (localhost), use empty string so links stay relative. */
const APP_BASE = process.env.NEXT_PUBLIC_APP_URL
  ? (process.env.NEXT_PUBLIC_APP_URL === 'http://localhost:3000' ? '' : process.env.NEXT_PUBLIC_APP_URL)
  : 'https://app.resolvaio.com';

export const metadata: Metadata = {
  title: 'Resolvaio — Security Deposit Recovery & Subscription Cancellation | US Consumer Protection',
  description:
    'Get your security deposit back with demand letters grounded in California, Texas, New York, and Florida landlord-tenant law. Cancel unwanted subscriptions citing ROSCA and state consumer protection statutes. Free diagnostic.',
  openGraph: {
    title: 'Resolvaio — Demand Letters & Cancellation Emails Grounded in US Law',
    description:
      'Security deposit recovery in CA, TX, NY, FL. Subscription cancellation in all 50 US states. Verified statute citations. Free diagnostic.',
  },
  alternates: {
    canonical: 'https://resolvaio.com',
  },
};

/**
 * Landing page — premium minimalism redesign.
 *
 * Sections: nav, hero, the difference (before/after), the problem,
 * how it works, citation engine, cancellation sequence, trust stack,
 * state coverage, pricing, FAQ, final CTA, footer.
 */

/* ------------------------------------------------------------------ */
/*  Data                                                              */
/* ------------------------------------------------------------------ */

const HOW_IT_WORKS = [
  {
    icon: FileText,
    step: '1',
    title: 'Tell us what happened',
    description:
      'Our diagnostic walks you through your situation, pulls your jurisdiction, and identifies which statutes apply. No legal background needed.',
  },
  {
    icon: Upload,
    step: '2',
    title: 'Upload the evidence',
    description:
      'Lease, itemization, photos, screenshots, cancellation attempts. AI vision pulls the deduction line items, dates, and dollar amounts straight from your documents.',
  },
  {
    icon: Scale,
    step: '3',
    title: 'Generate your letter',
    description:
      "A demand letter or cancellation sequence drafted with the specific statutory citations for your state \u2014 plus an itemized rebuttal table disputing every charge with the reasoning the law provides.",
  },
  {
    icon: Clock,
    step: '4',
    title: 'Send, track, and escalate',
    description:
      'Download the PDF for certified mail or send the cancellation sequence at Day 0, 7, and 14. We calculate every statutory deadline. If they ignore you, we generate the small-claims packet or the AG complaint.',
  },
];

const COMPARISON_ROWS = [
  {
    label: 'Where citations come from',
    them: 'A prompt or a stock library',
    us: 'Verified primary legal sources',
  },
  {
    label: 'Statute accuracy',
    them: 'Often invented or outdated',
    us: 'Validated against jurisdiction database',
  },
  {
    label: 'Jurisdiction match',
    them: 'One-size-fits-all',
    us: 'County-aware guidance for small claims procedures',
  },
  {
    label: 'Compliance',
    them: 'None \u2014 risks unauthorized practice claims',
    us: 'Scanner blocks prohibited language automatically',
  },
  {
    label: 'What happens after you send',
    them: "You're on your own",
    us: 'Deadline tracking, escalation packets, AG complaints',
  },
  {
    label: 'Built for',
    them: 'Anyone, broadly',
    us: 'Renters and subscribers, specifically',
  },
  {
    label: 'What it costs',
    them: '$0 + uncertain statutory accuracy',
    us: 'Free for cancellations, $49 for a deposit case',
  },
];

const FAQS = [
  {
    q: 'How is this different from a lawyer?',
    a: "A lawyer gives legal advice tailored to your specific case and represents you in disputes. Resolvaio is writing assistance \u2014 we draft documents grounded in the statutes that apply to your situation, but we don't evaluate your case, predict outcomes, or represent you. For most deposit and subscription disputes, a well-cited letter is often used as a first step in resolving these types of disputes. For complex cases, you should talk to a lawyer.",
  },
  {
    q: 'Is this legal advice?',
    a: "No. Resolvaio provides writing assistance and general information about consumer protection law. We don't evaluate your specific claim, predict whether you'll win, or recommend a course of action. Every letter is reviewable and editable before you send it. Review everything before sending.",
  },
  {
    q: 'How accurate are the citations?',
    a: "Every statute cited is validated against our database of primary legal sources before the letter is generated. We update the database when laws change. We do not pull from open-web scrapings, training data, or generative AI retrieval. If a citation can't be verified, the letter doesn't ship.",
  },
  {
    q: 'How long does it take?',
    a: 'The diagnostic takes about 5 minutes. Letter generation takes under a minute. The whole process \u2014 from answering questions to having a PDF ready for certified mail \u2014 is typically under 10 minutes.',
  },
  {
    q: "What if my state isn't supported?",
    a: "For deposit cases we currently support California, Texas, New York, and Florida. If you're elsewhere, you get a free generic template, links to your state's consumer protection resources, and a place on the waitlist. We add states as we can verify the statutes, court forms, and filing packets to the same standard.",
  },
  {
    q: 'Can my landlord sue me for sending a demand letter?',
    a: "A demand letter is a normal, lawful step in resolving a dispute \u2014 it's what attorneys send before filing in small claims. Resolvaio's letters are scanned for prohibited language and cite statutes that already exist. That said, every situation is different, and sending a demand letter does not prevent the other party from taking legal action of their own. If you're concerned about that possibility, consult a licensed attorney before sending.",
  },
  {
    q: 'What happens after I send the letter?',
    a: 'We track the statutory response deadline. If your landlord pays, you close the case. If they ignore you or respond inadequately, we generate the small-claims filing packet \u2014 court cover sheet, jurisdiction-specific forms, and instructions \u2014 or the state Attorney General complaint, depending on what\'s appropriate. We follow up with you at T+14, T+30, and T+60.',
  },
  {
    q: "What's the refund policy?",
    a: "Before your letter is generated, you can request a full refund within 7 days of purchase. After generation, refunds are available only for defective outputs (wrong jurisdiction, system errors, incorrect citations). Subscriptions can be cancelled anytime — no refund for the current billing period. One refund per account.",
  },
];

const STATES = [
  {
    state: 'California',
    counties: 'Los Angeles, San Francisco, San Diego, Sacramento',
  },
  {
    state: 'Texas',
    counties: 'Harris (Houston), Dallas, Travis (Austin), Bexar (San Antonio)',
  },
  {
    state: 'New York',
    counties: 'New York City, Nassau, Suffolk',
  },
  {
    state: 'Florida',
    counties: 'Miami-Dade, Broward, Hillsborough (Tampa)',
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function HomePage(): React.JSX.Element {
  return (
    <main className="relative min-h-screen">
      {/* Ambient background — quiet single-hue aurora behind everything. */}
      <div className="aurora" aria-hidden="true" />

      {/* Content sits above the aurora. */}
      <div className="relative z-10">
      {/* ============================================================ */}
      {/*  NAV — glass                                                 */}
      {/* ============================================================ */}
      <nav className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
        <div className="glass mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Logo />
          <div className="hidden items-center gap-8 text-[13px] sm:flex">
            <a href="#how-it-works" className="text-[#5F5F5F] transition-colors hover:text-[#111]">How It Works</a>
            <a href="#pricing" className="text-[#5F5F5F] transition-colors hover:text-[#111]">Pricing</a>
            <ToolsDropdown />
            <a href="#faq" className="text-[#5F5F5F] transition-colors hover:text-[#111]">FAQ</a>
            <Link href="/login" className="text-[#5F5F5F] transition-colors hover:text-[#111]">Sign In</Link>
            <a
              href="/start"
              className="rounded-lg bg-[#3B4CCA] px-4 py-2 font-medium text-white shadow-[0_2px_10px_rgba(59,76,202,0.35)] transition-all hover:bg-[#2C3AA8] active:scale-[0.98]"
            >
              Start Free Diagnostic
            </a>
          </div>
          <a
            href="/start"
            className="rounded-lg bg-[#3B4CCA] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#2C3AA8] active:scale-[0.98] sm:hidden"
          >
            Start Free Diagnostic
          </a>
        </div>
      </nav>

      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
          {/* Left — copy */}
          <div className="text-center lg:text-left">
            <p className="mb-5 text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
              Built for renters, subscribers, and anyone tired of getting ripped off
            </p>
            <h1 className="text-[38px] font-semibold leading-[1.1] tracking-tight text-[#111] sm:text-[50px]">
              Demand your deposit back.
              <br />
              Cancel the subscription.
              <br />
              <span className="text-[#3B4CCA]">Cite the actual law.</span>
            </h1>
            <p className="mt-8 text-[16px] leading-[1.7] text-[#5F5F5F]">
              Resolvaio writes demand letters and cancellation emails grounded in
              verified state-specific statutes &mdash; not generic templates your
              landlord has seen a hundred times, and not AI tools inventing case
              numbers that don&apos;t exist.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
              <a
                href="/start"
                className="inline-flex items-center gap-2 rounded-lg bg-[#3B4CCA] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_16px_rgba(59,76,202,0.4)] transition-all hover:bg-[#2C3AA8] hover:shadow-[0_6px_20px_rgba(59,76,202,0.5)] active:scale-[0.98]"
              >
                Start Free Diagnostic <ChevronRight className="h-4 w-4" />
              </a>
              <a
                href="#the-difference"
                className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#5F5F5F] transition-colors hover:text-[#111]"
              >
                See a sample letter <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-6 text-[12px] text-[#8A8A8A]">
              Writing assistance grounded in verified law. Not legal advice. Not a law firm.
            </p>
          </div>

          {/* Right — sample demand-letter mockup (the credibility proof) */}
          <div className="relative hidden items-center justify-center lg:flex">
            <div className="accent-glow" aria-hidden="true" />
            {/* Floating glass frame around a realistic letter preview */}
            <div className="glass-strong w-full max-w-[380px] rotate-[-1.2deg] p-3 shadow-[0_20px_60px_rgba(17,17,17,0.14)]">
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 px-2 pb-2.5 pt-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E4E4E1]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#E4E4E1]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#E4E4E1]" />
                <span className="ml-2 text-[10px] font-medium tracking-wide text-[#9A9A96]">
                  demand-letter.pdf
                </span>
              </div>
              {/* The "paper" */}
              <div className="rounded-xl bg-white px-6 py-6 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[#9A9A96]">
                  Via Certified Mail
                </p>
                <p className="mt-3 text-[12px] font-semibold text-[#111]">
                  Re: Return of Security Deposit
                </p>
                <div className="mt-3 space-y-1.5" aria-hidden="true">
                  <div className="h-2 w-full rounded bg-[#EFEFEC]" />
                  <div className="h-2 w-[92%] rounded bg-[#EFEFEC]" />
                  <div className="h-2 w-[78%] rounded bg-[#EFEFEC]" />
                </div>
                {/* The highlighted real statute — the whole point */}
                <div className="mt-4 rounded-lg border border-[#D9DDF6] bg-[#EEF0FB] px-3 py-2.5">
                  <p className="text-[11px] leading-[1.6] text-[#2C3AA8]">
                    Under <span className="font-semibold">Cal. Civ. Code &sect; 1950.5(g)</span>,
                    a landlord must return the deposit within{' '}
                    <span className="font-semibold">21 days</span> of move-out, itemized in
                    writing.
                  </p>
                </div>
                <div className="mt-4 space-y-1.5" aria-hidden="true">
                  <div className="h-2 w-full rounded bg-[#EFEFEC]" />
                  <div className="h-2 w-[85%] rounded bg-[#EFEFEC]" />
                </div>
                {/* Amount demanded */}
                <div className="mt-4 flex items-center justify-between border-t border-[#F0F0ED] pt-3">
                  <span className="text-[11px] text-[#5F5F5F]">Amount demanded</span>
                  <span className="text-[15px] font-semibold text-[#111]">$2,400.00</span>
                </div>
              </div>
              {/* Verified-citation stamp */}
              <div className="mt-3 flex items-center gap-2 px-2 pb-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3B4CCA]">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                <span className="text-[11px] font-medium text-[#5F5F5F]">
                  Citation verified against the current statute
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  THE DIFFERENCE (before / after)                             */}
      {/* ============================================================ */}
      <section id="the-difference" className="border-t border-white/60 bg-white/70 backdrop-blur-sm px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            See the Difference
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Same dispute. Two very different letters.
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Without */}
            <div className="rounded-2xl border border-red-200/60 bg-red-50/40 p-8">
              <div className="mb-5 flex items-center gap-2.5">
                <X className="h-5 w-5 text-red-500" />
                <span className="text-[14px] font-semibold text-red-700">Without Resolvaio</span>
              </div>
              <blockquote className="font-serif text-[14px] italic leading-[1.8] text-[#5F5F5F]">
                &ldquo;Dear Landlord,
                <br /><br />
                I am writing to request the return of my security deposit. I
                believe I am entitled to the full amount. Please return my
                deposit within a reasonable time or I will be forced to take
                further action.
                <br /><br />
                Sincerely, [Tenant]&rdquo;
              </blockquote>
              <p className="mt-5 text-[12px] leading-relaxed text-red-600/80">
                No statute cited. No deadline referenced. No legal basis. This
                gets filed in the trash.
              </p>
            </div>

            {/* With */}
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-8">
              <div className="mb-5 flex items-center gap-2.5">
                <Check className="h-5 w-5 text-emerald-600" />
                <span className="text-[14px] font-semibold text-emerald-700">With Resolvaio</span>
              </div>
              <blockquote className="font-serif text-[14px] italic leading-[1.8] text-[#5F5F5F]">
                &ldquo;Per Cal. Civ. Code &sect; 1950.5(g), you were required to
                return the security deposit or provide an itemized statement
                within 21 calendar days of move-out. As of the date of this
                letter &mdash; 34 days after vacating &mdash; neither the deposit
                nor an itemized statement has been received.
                <br /><br />
                California Civil Code &sect; 1950.5(l) provides that the bad
                faith retention of any portion of a security deposit may subject
                the landlord to statutory damages of up to twice the amount of
                the security deposit, in addition to actual damages.&rdquo;
              </blockquote>
              <p className="mt-5 text-[12px] leading-relaxed text-emerald-700/80">
                Specific statute. Specific deadline. Specific penalty provision.
                This gets attention.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  THE PROBLEM                                                 */}
      {/* ============================================================ */}
      <section className="border-t border-white/40 bg-[#F7F7F5]/50 backdrop-blur-sm px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            The Problem
          </p>
          <h2 className="mb-6 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Most dispute letters miss the law that actually applies.
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[15px] leading-[1.7] text-[#5F5F5F]">
            Generic templates cite no law and landlords toss them in the trash.
            AI tools that scrape the open web write confident letters with
            statute numbers that were repealed years ago &mdash; and the other
            side&apos;s attorney will notice. Legal help can cost more than the
            dispute itself. We built Resolvaio because none of the existing
            options work for the disputes that matter to normal people.
          </p>

          {/* Comparison table */}
          <div className="overflow-x-auto rounded-2xl border border-[#E8E8E5] bg-white">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-[#E8E8E5]">
                  <th className="p-4 text-left font-medium text-[#8A8A8A]"></th>
                  <th className="p-4 text-left font-medium text-[#8A8A8A]">
                    AI Tools / Generic Templates
                  </th>
                  <th className="p-4 text-left font-semibold text-[#111]">
                    Resolvaio
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className="border-b border-[#E8E8E5] last:border-0">
                    <td className="p-4 font-medium text-[#111]">
                      {row.label}
                    </td>
                    <td className="p-4 text-[#8A8A8A]">{row.them}</td>
                    <td className="p-4 font-medium text-[#111]">
                      {row.us}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                */}
      {/* ============================================================ */}
      <section
        id="how-it-works"
        className="border-t border-white/60 bg-white/70 backdrop-blur-sm px-6 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            How It Works
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Four steps. Ten minutes to a sendable letter.
          </h2>
          <div className="grid gap-10 sm:grid-cols-2">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="flex gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111] text-[14px] font-semibold text-white">
                  {step.step}
                </div>
                <div>
                  <h3 className="mb-2 text-[16px] font-semibold text-[#111]">
                    {step.title}
                  </h3>
                  <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CITATION ENGINE                                             */}
      {/* ============================================================ */}
      <section className="border-t border-white/40 bg-[#F7F7F5]/50 backdrop-blur-sm px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            The Citation Engine
          </p>
          <h2 className="mb-4 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Same dispute. Different state. Different law. Cited correctly.
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[15px] leading-[1.7] text-[#5F5F5F]">
            The reason templates fail is that the law isn&apos;t generic. A
            21-day return deadline in California isn&apos;t a 30-day deadline in
            Texas isn&apos;t a 14-day deadline in New York. Resolvaio cites the
            specific statute for the jurisdiction where you actually live.
          </p>

          <div className="space-y-4">
            {[
              {
                state: 'California',
                quote:
                  'Per Cal. Civ. Code \u00A7 1950.5(g), landlords are required to return the security deposit or provide an itemized statement within 21 calendar days of move-out. As of the date of this letter, 34 days have elapsed\u2026',
                statute: 'Cal. Civ. Code \u00A7 1950.5',
                remedy:
                  'Statutory remedies may include up to 2\u00D7 the deposit amount',
              },
              {
                state: 'Texas',
                quote:
                  'Under Tex. Prop. Code \u00A7 92.103, the deposit must be refunded within 30 days. Under Tex. Prop. Code \u00A7 92.109, a landlord who fails to return the deposit or provide an itemized accounting may be liable for $100 plus three times the amount wrongfully withheld, plus reasonable attorney\u2019s fees.',
                statute: 'Tex. Prop. Code \u00A7\u00A7 92.103, 92.109',
                remedy: 'Statutory remedies may include financial penalties',
              },
              {
                state: 'New York',
                quote:
                  'NY Gen. Oblig. Law \u00A7 7-108(1-a)(e) requires landlords to return the deposit within 14 days with an itemized statement of any deductions. Failure to comply may result in forfeiture of the landlord\u2019s right to retain any portion of the deposit.',
                statute: 'NY Gen. Oblig. Law \u00A7 7-108',
                remedy:
                  'Statutory remedies may include forfeiture plus additional damages',
              },
            ].map((ex) => (
              <div
                key={ex.state}
                className="rounded-2xl border border-[#E8E8E5] bg-white p-8"
              >
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-[#8A8A8A]">
                  {ex.state}
                </p>
                <blockquote className="mb-4 font-serif text-[14px] italic leading-[1.8] text-[#5F5F5F]">
                  &ldquo;{ex.quote}&rdquo;
                </blockquote>
                <p className="text-[12px] text-[#8A8A8A]">
                  {ex.statute} &middot; {ex.remedy}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-[14px] font-medium text-[#5F5F5F]">
            No generic templates. No guessed citations. Only jurisdiction-specific
            law. The compliance scanner double-checks every citation against our
            primary source database before the letter hits your screen.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CANCELLATION SEQUENCE                                       */}
      {/* ============================================================ */}
      <section className="border-t border-white/60 bg-white/70 backdrop-blur-sm px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            The Cancellation Sequence
          </p>
          <h2 className="mb-4 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Three emails. Escalating citations. One sequence they can&apos;t ignore.
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[15px] leading-[1.7] text-[#5F5F5F]">
            Most cancellation attempts fail because they&apos;re polite requests
            with no legal backing. Resolvaio generates a 3-step sequence that
            escalates from request to regulatory complaint &mdash; each email
            citing the specific federal and state law that applies.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                day: 'Day 0',
                title: 'Formal Cancellation Request',
                icon: Mail,
                body: 'Cites ROSCA and your state\u2019s auto-renewal law. Requests written confirmation within 7 days.',
              },
              {
                day: 'Day 7',
                title: 'Follow-Up with Escalation',
                icon: AlertTriangle,
                body: 'References the unanswered first email. Names the specific regulatory agency. Mentions credit card dispute rights.',
              },
              {
                day: 'Day 14',
                title: 'Final Notice',
                icon: Download,
                body: 'Provides links to FTC and CFPB complaint processes. References Fair Credit Billing Act dispute rights.',
              },
            ].map((step) => (
              <div
                key={step.day}
                className="rounded-2xl border border-[#E8E8E5] bg-[#F7F7F5] p-6 sm:p-8"
              >
                <div className="mb-4 flex items-center gap-2.5">
                  <step.icon className="h-4 w-4 text-[#5F5F5F]" />
                  <span className="text-[12px] font-semibold uppercase tracking-widest text-[#8A8A8A]">
                    {step.day}
                  </span>
                </div>
                <h3 className="mb-2 text-[16px] font-semibold text-[#111]">
                  {step.title}
                </h3>
                <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-[14px] text-[#5F5F5F]">
            Works for gyms, telecom, SaaS, streaming, and mobile apps. Federal
            baseline in all 50 states. State-specific citations for California
            (ARL) and New York (GBL &sect; 527-a).
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TRUST STACK                                                 */}
      {/* ============================================================ */}
      <section id="trust" className="border-t border-white/40 bg-[#F7F7F5]/50 backdrop-blur-sm px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            The Trust Stack
          </p>
          <h2 className="mb-4 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Trust isn&apos;t a tagline. It&apos;s the architecture.
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-[15px] leading-[1.7] text-[#5F5F5F]">
            Resolvaio is a writing assistance tool, not a law firm. That
            distinction matters &mdash; and the whole product is built to honor
            it.
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E8E8E5] bg-white p-8">
              <Shield className="mb-4 h-6 w-6 text-[#111]" />
              <h3 className="mb-2 text-[16px] font-semibold text-[#111]">
                Verified primary sources
              </h3>
              <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">
                Statutes are pulled from a curated database of primary legal
                sources &mdash; state codes, federal regulations, official
                rulemaking. We don&apos;t scrape the open web or rely on AI
                training data for legal citations.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E8E5] bg-white p-8">
              <Scale className="mb-4 h-6 w-6 text-[#111]" />
              <h3 className="mb-2 text-[16px] font-semibold text-[#111]">
                Compliance scanner on every draft
              </h3>
              <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">
                Before you see a letter, a compliance scanner checks it for
                prohibited language &mdash; no legal advice, no outcome
                predictions, no evaluative claims. If something would cross into
                unauthorized practice of law, it gets rewritten automatically.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8E8E5] bg-white p-8">
              <AlertTriangle className="mb-4 h-6 w-6 text-[#111]" />
              <h3 className="mb-2 text-[16px] font-semibold text-[#111]">
                We tell you when we can&apos;t help
              </h3>
              <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">
                If your state isn&apos;t supported, you get an honest decline, a
                free generic template, your state&apos;s consumer protection
                resources, and a spot on the waitlist. We&apos;d rather decline a
                case than generate a letter we haven&apos;t verified.
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-[12px] text-[#8A8A8A]">
            Subscription cancellations supported in all 50 states &mdash; federal
            ROSCA baseline plus state-specific citations for California (ARL) and
            New York (GBL &sect; 527-a).
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  STATE COVERAGE                                              */}
      {/* ============================================================ */}
      <section className="border-t border-white/60 bg-white/70 backdrop-blur-sm px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            Where We Operate
          </p>
          <h2 className="mb-10 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Deposit cases, by state.
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {STATES.map((s) => (
              <div
                key={s.state}
                className="flex items-start gap-4 rounded-2xl border border-[#E8E8E5] bg-[#F7F7F5] p-6"
              >
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#5F5F5F]" />
                <div>
                  <p className="text-[15px] font-semibold text-[#111]">{s.state}</p>
                  <p className="mt-1 text-[14px] text-[#5F5F5F]">{s.counties}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-[14px] text-[#5F5F5F]">
            Each county has its own small claims court &mdash; different forms,
            different filing fees, different page limits. We ship the right
            packet for yours.
          </p>
          <p className="mt-2 text-center text-[14px] font-medium text-[#111]">
            Subscription cancellation: All 50 US states.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  PRICING                                                     */}
      {/* ============================================================ */}
      <section id="pricing" className="border-t border-white/40 bg-[#F7F7F5]/50 backdrop-blur-sm px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            Pricing
          </p>
          <h2 className="mb-2 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Priced like a tool, not a lawsuit.
          </h2>
          <p className="mx-auto mb-12 max-w-lg text-center text-[15px] leading-[1.7] text-[#5F5F5F]">
            Legal help can cost more than the dispute itself. Resolvaio handles
            it for $49 &mdash; or free if it&apos;s a subscription.
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            {/* Free */}
            <div className="rounded-2xl border border-[#E8E8E5] bg-white p-8">
              <h3 className="text-[16px] font-semibold text-[#111]">
                Subscription Cancellation
              </h3>
              <p className="mt-3 text-[36px] font-semibold tracking-tight text-[#111]">Free</p>
              <p className="mt-1 text-[13px] text-[#8A8A8A]">
                Always free. No card required.
              </p>
              <ul className="mt-6 space-y-3 text-[14px] text-[#5F5F5F]">
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> 3-step email sequence (Day 0, 7, 14)</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Federal ROSCA + state-specific citations</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Per-vertical templates (gym, telecom, SaaS, streaming, mobile app)</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> FTC and CFPB filing guidance</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Deadline timeline</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> All 50 states</li>
              </ul>
              <a
                href="/start?wedge=subscription"
                className="mt-8 block rounded-lg border border-[#E8E8E5] py-3 text-center text-[14px] font-semibold text-[#111] transition-all hover:border-[#111]/20 hover:bg-[#F7F7F5] active:scale-[0.98]"
              >
                Start Free Diagnostic
              </a>
            </div>

            {/* $49 — highlighted focal glass card */}
            <div className="glass-strong relative border-[#C7CDF3] bg-[rgba(238,240,251,0.72)] p-8 shadow-[0_16px_48px_rgba(59,76,202,0.16)]">
              <span className="absolute -top-3 left-6 rounded-full bg-[#3B4CCA] px-3 py-1 text-[11px] font-semibold tracking-wide text-white shadow-[0_2px_8px_rgba(59,76,202,0.4)]">
                MOST CHOSEN
              </span>
              <h3 className="text-[16px] font-semibold text-[#111]">
                Single Deposit Case
              </h3>
              <p className="mt-3 text-[36px] font-semibold tracking-tight text-[#111]">$49</p>
              <p className="mt-1 text-[13px] text-[#8A8A8A]">
                One-time payment
              </p>
              <p className="mt-1 text-[12px] italic text-[#8A8A8A]">
                For one landlord. One letter. One clear next step.
              </p>
              <ul className="mt-6 space-y-3 text-[14px] text-[#5F5F5F]">
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Full demand letter + PDF</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> State-specific statutory citations</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> AI vision extraction from documents</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Itemized rebuttal table</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Escalation packet (small claims + AG)</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Outcome tracking at T+14, T+30, T+60</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Refund for defective outputs</li>
              </ul>
              <a
                href="/start?wedge=deposit"
                className="mt-8 block rounded-lg bg-[#3B4CCA] py-3 text-center text-[14px] font-semibold text-white shadow-[0_4px_16px_rgba(59,76,202,0.4)] transition-all hover:bg-[#2C3AA8] active:scale-[0.98]"
              >
                Start Deposit Case
              </a>
            </div>

            {/* Unlimited */}
            <div className="relative rounded-2xl border border-[#E8E8E5] bg-white p-8">
              <span className="absolute -top-3 left-6 rounded-full bg-[#111] px-3 py-1 text-[11px] font-semibold tracking-wide text-white">
                BEST VALUE
              </span>
              <h3 className="text-[16px] font-semibold text-[#111]">Unlimited</h3>
              <p className="mt-3 text-[36px] font-semibold tracking-tight text-[#111]">
                $15<span className="text-[18px] font-normal text-[#5F5F5F]">/mo</span>
              </p>
              <p className="mt-1 text-[13px] text-[#8A8A8A]">
                or $129/year ($10.75/mo)
              </p>
              <p className="mt-1 text-[12px] italic text-[#8A8A8A]">
                For renters with more than one deposit to recover.
              </p>
              <ul className="mt-6 space-y-3 text-[14px] text-[#5F5F5F]">
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Everything in Single Case</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Unlimited deposit cases</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Priority generation</li>
                <li className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> All cases in one dashboard</li>
              </ul>
              <a
                href={`${APP_BASE}/new?plan=unlimited`}
                className="mt-8 block rounded-lg border border-[#E8E8E5] py-3 text-center text-[14px] font-semibold text-[#111] transition-all hover:border-[#111]/20 hover:bg-[#F7F7F5] active:scale-[0.98]"
              >
                Go Unlimited
              </a>
            </div>
          </div>

          <p className="mt-8 text-center text-[12px] text-[#8A8A8A]">
            Cancel anytime. Refund available before generation. One user,
            one account &mdash; we don&apos;t currently support firm or
            shared-team usage.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TRUST SIGNALS (data-driven, gated by threshold)             */}
      {/* ============================================================ */}
      <TrustSignals />

      {/* ============================================================ */}
      {/*  FAQ                                                         */}
      {/* ============================================================ */}
      <section id="faq" className="border-t border-white/60 bg-white/70 backdrop-blur-sm px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            FAQ
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Common questions
          </h2>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-[#E8E8E5] bg-[#F7F7F5]">
                <summary className="flex cursor-pointer items-center justify-between px-6 py-5 text-[15px] font-semibold text-[#111]">
                  {faq.q}
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#8A8A8A] transition-transform group-open:rotate-90" />
                </summary>
                <p className="px-6 pb-5 text-[14px] leading-[1.7] text-[#5F5F5F]">
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
      <section className="px-6 py-24 sm:py-32">
        <div className="glass-strong relative mx-auto max-w-2xl overflow-hidden px-8 py-14 text-center sm:px-14">
          <div className="accent-glow" aria-hidden="true" />
          <h2 className="text-[32px] font-semibold tracking-tight text-[#111] sm:text-[40px]">
            Most disputes stall before anything is sent.
          </h2>
          <p className="mt-6 text-[16px] leading-[1.7] text-[#5F5F5F]">
            A well-cited demand letter is the first step. The diagnostic is free.
            The statutes are verified. The letter is yours to review before you
            send.
          </p>
          <a
            href="/start"
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-[#3B4CCA] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_16px_rgba(59,76,202,0.4)] transition-all hover:bg-[#2C3AA8] hover:shadow-[0_6px_20px_rgba(59,76,202,0.5)] active:scale-[0.98]"
          >
            Start Free Diagnostic <ChevronRight className="h-4 w-4" />
          </a>
          <p className="mt-6 text-[12px] text-[#8A8A8A]">
            No card required. See your statutes before you pay. See our refund
            policy.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-[#E8E8E5] px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Logo />
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-[#8A8A8A]">
                Demand letters and cancellation emails grounded in verified
                consumer protection law. Writing assistance, not legal advice.
              </p>
            </div>
            <div className="flex gap-10 text-[13px] text-[#8A8A8A]">
              <div className="space-y-2.5">
                <p className="font-semibold text-[#5F5F5F]">Tools</p>
                <Link href="/tools/cancel-subscription" className="block transition-colors hover:text-[#111]">Cancel Subscription</Link>
                <Link href="/tools/deposit-deadline" className="block transition-colors hover:text-[#111]">Deposit Deadline Calculator</Link>
                <Link href="/blog" className="block transition-colors hover:text-[#111]">Blog</Link>
              </div>
              <div className="space-y-2.5">
                <p className="font-semibold text-[#5F5F5F]">Account</p>
                <a href="/start" className="block transition-colors hover:text-[#111]">Start Diagnostic</a>
                <Link href="/login" className="block transition-colors hover:text-[#111]">Sign In</Link>
                <Link href="/about" className="block transition-colors hover:text-[#111]">About</Link>
              </div>
              <div className="space-y-2.5">
                <p className="font-semibold text-[#5F5F5F]">Legal</p>
                <Link href="/legal/terms" className="block transition-colors hover:text-[#111]">Terms of Service</Link>
                <Link href="/legal/privacy" className="block transition-colors hover:text-[#111]">Privacy Policy</Link>
                <Link href="/legal/cookies" className="block transition-colors hover:text-[#111]">Cookie Policy</Link>
                <Link href="/legal/acceptable-use" className="block transition-colors hover:text-[#111]">Acceptable Use</Link>
                <Link href="/legal/ai-disclosure" className="block transition-colors hover:text-[#111]">AI Disclosure</Link>
                <Link href="/legal/accessibility" className="block transition-colors hover:text-[#111]">Accessibility</Link>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-[#E8E8E5] pt-8 text-center text-[12px] leading-relaxed text-[#8A8A8A]">
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
      </div>{/* /content wrapper */}

      {/* JSON-LD: Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Resolvaio',
            url: 'https://resolvaio.com',
            description:
              'Writing assistance for US consumer disputes. Demand letters and cancellation emails grounded in verified state and federal statutes.',
            areaServed: {
              '@type': 'Country',
              name: 'United States',
            },
            knowsAbout: [
              'Security deposit recovery',
              'Subscription cancellation',
              'Consumer protection law',
              'Landlord-tenant law',
            ],
          }),
        }}
      />

      {/* JSON-LD: FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.a,
              },
            })),
          }),
        }}
      />
    </main>
  );
}
