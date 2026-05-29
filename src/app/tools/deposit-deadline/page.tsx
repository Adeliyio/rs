import type { Metadata } from 'next';
import Link from 'next/link';
import { ToolsDropdown } from '@/components/marketing/tools-dropdown';
import { DeadlineCalculator } from './calculator';

/* ------------------------------------------------------------------ */
/*  Metadata                                                          */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: 'Security Deposit Deadline Calculator — Free, All 50 States',
  description:
    'Enter your state and move-out date. See the exact deadline your landlord has to return your deposit, the statute that requires it, and the penalty if they miss it. Free.',
  openGraph: {
    title: 'Security Deposit Deadline Calculator | Resolvaio',
    description:
      'Check whether your landlord has missed the statutory deadline to return your security deposit.',
  },
};

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function DepositDeadlinePage() {
  return (
    <main className="min-h-screen bg-[#F7F7F5]">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-[#E8E8E5] bg-[#F7F7F5]/95 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-[#111]">
            Resolvaio
          </Link>
          <div className="hidden items-center gap-8 text-[13px] sm:flex">
            <ToolsDropdown />
            <Link href="/blog" className="text-[#5F5F5F] transition-colors hover:text-[#111]">Blog</Link>
            <Link href="/login" className="text-[#5F5F5F] transition-colors hover:text-[#111]">Sign In</Link>
            <Link
              href="/new"
              className="rounded-lg bg-[#111] px-4 py-2 font-medium text-white transition-all hover:bg-[#222] active:scale-[0.98]"
            >
              Start Free Diagnostic
            </Link>
          </div>
          <Link
            href="/new"
            className="rounded-lg bg-[#111] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#222] active:scale-[0.98] sm:hidden"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center sm:py-24">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[36px] font-semibold leading-[1.1] tracking-tight text-[#111] sm:text-[48px]">
            Security deposit
            <br />
            <span className="text-[#5F5F5F]">deadline calculator.</span>
          </h1>
          <p className="mt-6 text-[16px] leading-[1.7] text-[#5F5F5F]">
            Enter your state and move-out date. We&apos;ll show you the exact
            deadline your landlord has to return your deposit, the statute that
            requires it, and what happens if they miss it.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="px-6 pb-20 sm:pb-24">
        <div className="mx-auto max-w-2xl">
          <DeadlineCalculator />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[#E8E8E5] bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-[24px] font-semibold tracking-tight text-[#111]">
            What this calculator does
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="text-center">
              <p className="mb-2 text-[28px] font-semibold text-[#111]">1</p>
              <h3 className="text-[15px] font-semibold text-[#111]">Looks up your state law</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-[#5F5F5F]">
                Each state has a different deadline. We pull the exact statute
                and number of days for your jurisdiction.
              </p>
            </div>
            <div className="text-center">
              <p className="mb-2 text-[28px] font-semibold text-[#111]">2</p>
              <h3 className="text-[15px] font-semibold text-[#111]">Calculates your deadline</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-[#5F5F5F]">
                From your move-out date, we calculate the exact calendar date
                your landlord&apos;s deadline expires.
              </p>
            </div>
            <div className="text-center">
              <p className="mb-2 text-[28px] font-semibold text-[#111]">3</p>
              <h3 className="text-[15px] font-semibold text-[#111]">Shows the penalty</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-[#5F5F5F]">
                If the deadline has passed, you see the specific penalty
                provision the statute provides.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer + Footer */}
      <footer className="border-t border-[#E8E8E5] px-6 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <Link href="/" className="text-[15px] font-semibold text-[#111]">
            Resolvaio
          </Link>
          <p className="mx-auto mt-4 max-w-2xl text-[12px] leading-relaxed text-[#8A8A8A]">
            This calculator provides general information about statutory
            deadlines. It does not constitute legal advice and does not account
            for all possible exceptions (holidays, weekends, special
            circumstances). Verify current law with official sources. Consider
            consulting a licensed attorney for advice about your specific situation.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-[#8A8A8A]">
            <Link href="/legal/terms" className="transition-colors hover:text-[#111]">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-[#111]">Privacy</Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-[#111]">Cookies</Link>
            <Link href="/legal/ai-disclosure" className="transition-colors hover:text-[#111]">AI Disclosure</Link>
            <Link href="/legal/accessibility" className="transition-colors hover:text-[#111]">Accessibility</Link>
          </div>
          <p className="mt-4 text-[12px] text-[#8A8A8A]">
            &copy; {new Date().getFullYear()} Resolvaio. All rights reserved.
            Resolvaio is owned and operated by Nikola Innovations Limited.
          </p>
        </div>
      </footer>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Resolvaio Security Deposit Deadline Calculator',
            description: 'Free calculator showing the exact deadline your landlord has to return your security deposit based on your state law.',
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            provider: { '@type': 'Organization', name: 'Resolvaio', url: 'https://resolvaio.com' },
          }),
        }}
      />
    </main>
  );
}
