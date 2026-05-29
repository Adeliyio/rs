import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Mail,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { ToolsDropdown } from '@/components/marketing/tools-dropdown';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface BarrierItem {
  barrier: string;
  resolution: string;
}

interface LawItem {
  name: string;
  description: string;
}

export interface VerticalPageData {
  /** URL slug — e.g. "gym", "telecom" */
  slug: string;
  /** Display name — e.g. "Gym Membership" */
  displayName: string;
  /** Hero headline — e.g. "Cancel Your Gym Membership" */
  heroHeadline: string;
  /** Hero subheadline — the grayed line */
  heroSubheadline: string;
  /** One paragraph describing the problem */
  heroParagraph: string;
  /** Common companies in this vertical */
  companies: string[];
  /** Barriers + how the tool addresses them */
  barriers: BarrierItem[];
  /** What Email 1 does for this vertical */
  email1Summary: string;
  /** What Email 2 does for this vertical */
  email2Summary: string;
  /** What Email 3 does for this vertical */
  email3Summary: string;
  /** Applicable laws */
  laws: LawItem[];
  /** Vertical-specific tip or note */
  proTip: string;
  /** Other verticals to cross-link (slug + displayName) */
  otherVerticals: { slug: string; name: string }[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function VerticalCancelPage({ data }: { data: VerticalPageData }) {
  return (
    <main className="min-h-screen bg-[#F7F7F5]">
      {/* ============================================================ */}
      {/*  NAV                                                         */}
      {/* ============================================================ */}
      <nav className="sticky top-0 z-40 border-b border-[#E8E8E5] bg-[#F7F7F5]/95 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-[#111]">
            Resolvaio
          </Link>
          <div className="hidden items-center gap-8 text-[13px] sm:flex">
            <a href="#barriers" className="text-[#5F5F5F] transition-colors hover:text-[#111]">Common Barriers</a>
            <a href="#sequence" className="text-[#5F5F5F] transition-colors hover:text-[#111]">The Sequence</a>
            <ToolsDropdown />
            <Link href="/blog" className="text-[#5F5F5F] transition-colors hover:text-[#111]">Blog</Link>
            <Link href="/login" className="text-[#5F5F5F] transition-colors hover:text-[#111]">Sign In</Link>
            <Link
              href="/new?wedge=subscription"
              className="rounded-lg bg-[#111] px-4 py-2 font-medium text-white transition-all hover:bg-[#222] active:scale-[0.98]"
            >
              Cancel Free
            </Link>
          </div>
          <Link
            href="/new?wedge=subscription"
            className="rounded-lg bg-[#111] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#222] active:scale-[0.98] sm:hidden"
          >
            Cancel Free
          </Link>
        </div>
      </nav>

      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section className="px-6 py-24 text-center sm:py-32">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E8E8E5] bg-white px-4 py-1.5 text-[13px] font-medium text-[#5F5F5F]">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            100% free. No card required.
          </div>
          <h1 className="text-[42px] font-semibold leading-[1.1] tracking-tight text-[#111] sm:text-[52px]">
            {data.heroHeadline}
            <br />
            <span className="text-[#5F5F5F]">{data.heroSubheadline}</span>
          </h1>
          <p className="mt-8 text-[16px] leading-[1.7] text-[#5F5F5F]">
            {data.heroParagraph}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/new?wedge=subscription"
              className="inline-flex items-center gap-2 rounded-lg bg-[#111] px-8 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-[#222] active:scale-[0.98]"
            >
              Generate Your Free Emails <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/tools/cancel-subscription"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#5F5F5F] transition-colors hover:text-[#111]"
            >
              How it works <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-6 text-[12px] text-[#8A8A8A]">
            Writing assistance grounded in verified law. Not legal advice. Not a law firm.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  COMPANIES                                                   */}
      {/* ============================================================ */}
      <section className="border-t border-[#E8E8E5] bg-white px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-6 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            Works for companies like
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {data.companies.map((company) => (
              <span
                key={company}
                className="rounded-full border border-[#E8E8E5] bg-[#F7F7F5] px-4 py-1.5 text-[13px] font-medium text-[#5F5F5F]"
              >
                {company}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  BARRIERS                                                    */}
      {/* ============================================================ */}
      <section id="barriers" className="border-t border-[#E8E8E5] px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            Common Barriers
          </p>
          <h2 className="mb-4 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            They make it hard to cancel on purpose.
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[15px] leading-[1.7] text-[#5F5F5F]">
            Our diagnostic identifies the specific barrier you&apos;re facing
            and the emails address it directly with the applicable law.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {data.barriers.map((item, i) => (
              <div key={i} className="rounded-2xl border border-[#E8E8E5] bg-white p-6">
                <p className="text-[15px] font-semibold text-[#111]">{item.barrier}</p>
                <p className="mt-2 text-[14px] leading-[1.7] text-[#5F5F5F]">{item.resolution}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  THE SEQUENCE                                                */}
      {/* ============================================================ */}
      <section id="sequence" className="border-t border-[#E8E8E5] bg-white px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            Your 3-Email Sequence
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            Escalating pressure. All free.
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E8E8E5] bg-[#F7F7F5] p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[#5F5F5F]" />
                <span className="text-[12px] font-semibold uppercase tracking-widest text-[#8A8A8A]">Day 0</span>
              </div>
              <h3 className="mb-2 text-[16px] font-semibold text-[#111]">Formal Cancellation Demand</h3>
              <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">{data.email1Summary}</p>
            </div>
            <div className="rounded-2xl border border-[#E8E8E5] bg-[#F7F7F5] p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 text-[#5F5F5F]" />
                <span className="text-[12px] font-semibold uppercase tracking-widest text-[#8A8A8A]">Day 7</span>
              </div>
              <h3 className="mb-2 text-[16px] font-semibold text-[#111]">Follow-Up with Escalation</h3>
              <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">{data.email2Summary}</p>
            </div>
            <div className="rounded-2xl border border-[#E8E8E5] bg-[#F7F7F5] p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-[#5F5F5F]" />
                <span className="text-[12px] font-semibold uppercase tracking-widest text-[#8A8A8A]">Day 14</span>
              </div>
              <h3 className="mb-2 text-[16px] font-semibold text-[#111]">Final Notice</h3>
              <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">{data.email3Summary}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  PRO TIP                                                     */}
      {/* ============================================================ */}
      <section className="border-t border-[#E8E8E5] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-[#E8E8E5] bg-white p-8">
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-widest text-[#8A8A8A]">
              Good to know
            </p>
            <p className="text-[15px] leading-[1.7] text-[#5F5F5F]">
              {data.proTip}
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  LEGAL BASIS                                                 */}
      {/* ============================================================ */}
      <section id="law" className="border-t border-[#E8E8E5] bg-white px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            Legal Basis
          </p>
          <h2 className="mb-12 text-center text-[28px] font-semibold tracking-tight text-[#111] sm:text-[32px]">
            The law that applies to your situation.
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {data.laws.map((law, i) => (
              <div key={i} className="rounded-2xl border border-[#E8E8E5] bg-[#F7F7F5] p-6">
                <h3 className="mb-2 text-[15px] font-semibold text-[#111]">{law.name}</h3>
                <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">{law.description}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-[12px] text-[#8A8A8A]">
            This is general information about these statutes.
            Verify current law with official sources.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CTA                                                         */}
      {/* ============================================================ */}
      <section className="border-t border-[#E8E8E5] px-6 py-24 text-center sm:py-32">
        <div className="mx-auto max-w-xl">
          <h2 className="text-[32px] font-semibold tracking-tight text-[#111] sm:text-[40px]">
            Stop paying for something you don&apos;t use.
          </h2>
          <p className="mt-6 text-[16px] leading-[1.7] text-[#5F5F5F]">
            The diagnostic takes 5 minutes. The emails cite real law.
            It&apos;s free. No card required.
          </p>
          <Link
            href="/new?wedge=subscription"
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-[#111] px-8 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-[#222] active:scale-[0.98]"
          >
            Generate Your Free Emails <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-6 text-[12px] text-[#8A8A8A]">
            No card required. Takes about 5 minutes.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  OTHER VERTICALS                                             */}
      {/* ============================================================ */}
      <section className="border-t border-[#E8E8E5] bg-white px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-6 text-center text-[13px] font-medium uppercase tracking-widest text-[#8A8A8A]">
            Also cancel
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {data.otherVerticals.map((v) => (
              <Link
                key={v.slug}
                href={`/cancel/${v.slug}`}
                className="rounded-full border border-[#E8E8E5] bg-[#F7F7F5] px-5 py-2 text-[13px] font-medium text-[#5F5F5F] transition-all hover:border-[#111]/20 hover:text-[#111]"
              >
                {v.name}
              </Link>
            ))}
            <Link
              href="/tools/cancel-subscription"
              className="rounded-full border border-[#E8E8E5] bg-[#F7F7F5] px-5 py-2 text-[13px] font-medium text-[#5F5F5F] transition-all hover:border-[#111]/20 hover:text-[#111]"
            >
              All subscriptions
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-[#E8E8E5] px-6 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <Link href="/" className="text-[15px] font-semibold text-[#111]">
            Resolvaio
          </Link>
          <p className="mx-auto mt-6 max-w-2xl text-[12px] leading-relaxed text-[#8A8A8A]">
            Resolvaio provides writing assistance and general information about
            consumer disputes. It does not provide legal advice, does not
            evaluate claims, and does not guarantee outcomes. Resolvaio is not a
            law firm, is not a substitute for an attorney, and the use of
            Resolvaio does not create an attorney-client relationship. Individual
            results vary. Review all content before sending.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-[#8A8A8A]">
            <Link href="/legal/terms" className="transition-colors hover:text-[#111]">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-[#111]">Privacy</Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-[#111]">Cookies</Link>
            <Link href="/legal/acceptable-use" className="transition-colors hover:text-[#111]">Acceptable Use</Link>
            <Link href="/legal/ai-disclosure" className="transition-colors hover:text-[#111]">AI Disclosure</Link>
            <Link href="/legal/accessibility" className="transition-colors hover:text-[#111]">Accessibility</Link>
          </div>
          <p className="mt-4 text-[12px] text-[#8A8A8A]">
            &copy; {new Date().getFullYear()} Resolvaio. All rights reserved.
            Resolvaio is owned and operated by Nikola Innovations Limited.
          </p>
        </div>
      </footer>
    </main>
  );
}
