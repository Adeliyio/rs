import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { ARTICLES } from '@/lib/blog/articles';
import { ToolsDropdown } from '@/components/marketing/tools-dropdown';

export const metadata: Metadata = {
  title: 'Blog — Security Deposit Law, Subscription Cancellation, and Consumer Rights',
  description:
    'Guides grounded in real statutes: security deposit law by state, subscription cancellation rights, demand letter writing, and small claims court procedures.',
  openGraph: {
    title: 'Resolvaio Blog',
    description: 'Consumer rights guides backed by verified statute citations.',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  'deposit-state': 'Security Deposit',
  'deposit-general': 'Deposit Recovery',
  subscription: 'Subscription Cancellation',
  'consumer-rights': 'Consumer Rights',
};

export default function BlogIndexPage() {
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
            <Link href="/blog" className="text-[#111] font-medium">Blog</Link>
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
          <h1 className="text-[36px] font-semibold tracking-tight text-[#111] sm:text-[48px]">
            Consumer rights,
            <br />
            <span className="text-[#5F5F5F]">grounded in the statute.</span>
          </h1>
          <p className="mt-6 text-[16px] leading-[1.7] text-[#5F5F5F]">
            Guides on security deposit law, subscription cancellation rights,
            demand letter writing, and small claims court &mdash; all citing the
            specific statutes that apply.
          </p>
        </div>
      </section>

      {/* Articles */}
      <section className="border-t border-[#E8E8E5] bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-6 sm:grid-cols-2">
            {ARTICLES.map((article) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group rounded-2xl border border-[#E8E8E5] bg-[#F7F7F5] p-6 transition-all hover:border-[#111]/10 hover:shadow-premium"
              >
                <span className="inline-block rounded-full bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-[#8A8A8A]">
                  {CATEGORY_LABELS[article.category] ?? article.category}
                </span>
                <h2 className="mt-4 text-[16px] font-semibold leading-snug text-[#111] group-hover:text-primary transition-colors">
                  {article.title}
                </h2>
                <p className="mt-2 text-[13px] leading-[1.6] text-[#5F5F5F] line-clamp-3">
                  {article.description}
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-[#5F5F5F] group-hover:text-[#111] transition-colors">
                  Read article <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#E8E8E5] px-6 py-16 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="text-[24px] font-semibold tracking-tight text-[#111]">
            Ready to take action?
          </h2>
          <p className="mt-3 text-[15px] text-[#5F5F5F]">
            Subscription cancellation is free. Deposit demand letters start at $49.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/tools/cancel-subscription"
              className="inline-flex items-center gap-2 rounded-lg bg-[#111] px-6 py-3 text-[14px] font-semibold text-white transition-all hover:bg-[#222] active:scale-[0.98]"
            >
              Cancel a Subscription — Free
            </Link>
            <Link
              href="/new?wedge=deposit"
              className="inline-flex items-center gap-2 rounded-lg border border-[#E8E8E5] px-6 py-3 text-[14px] font-semibold text-[#111] transition-all hover:bg-[#F7F7F5] active:scale-[0.98]"
            >
              Start Deposit Case
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E8E8E5] px-6 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <Link href="/" className="text-[15px] font-semibold text-[#111]">
            Resolvaio
          </Link>
          <p className="mx-auto mt-4 max-w-2xl text-[12px] leading-relaxed text-[#8A8A8A]">
            Resolvaio provides writing assistance and general information about
            consumer disputes. It does not provide legal advice, does not
            evaluate claims, and does not guarantee outcomes. Review all content
            before acting. Individual results vary.
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
