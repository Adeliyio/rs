import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { ARTICLES } from '@/lib/blog/articles';
import { ToolsDropdown } from '@/components/marketing/tools-dropdown';
import { Logo } from '@/components/logo';
import { safeJsonLd } from '@/lib/safe-json-ld';
import { breadcrumbSchema } from '@/lib/seo/schema';

export const metadata: Metadata = {
  // Template appends "| Resolvaio", so keep the base title short enough to fit.
  title: 'Security Deposit & Subscription Cancellation Guides',
  description:
    'Guides grounded in real US statutes: security deposit law for CA, TX, NY, and FL, subscription cancellation under ROSCA, and small claims procedures.',
  openGraph: {
    title: 'Resolvaio Blog — US Consumer Rights Guides',
    description: 'Consumer rights guides backed by verified US statute citations. Security deposit law by state, subscription cancellation, and small claims court.',
  },
  alternates: {
    canonical: 'https://resolvaio.com/blog',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  'deposit-state': 'Security Deposit',
  'deposit-general': 'Deposit Recovery',
  subscription: 'Subscription Cancellation',
  'consumer-rights': 'Consumer Rights',
};

export default function BlogIndexPage() {
  const breadcrumb = breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
  ]);

  return (
    <main className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" aria-label="Resolvaio home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-8 text-[13px] sm:flex">
            <ToolsDropdown />
            <Link href="/blog" className="text-foreground font-medium">Blog</Link>
            <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">Sign In</Link>
            <Link
              href="/start"
              className="rounded-lg bg-foreground px-4 py-2 font-medium text-white transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              Start Free Diagnostic
            </Link>
          </div>
          <Link
            href="/start"
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white transition-all hover:bg-foreground/90 active:scale-[0.98] sm:hidden"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center sm:py-24">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[36px] font-semibold tracking-tight text-foreground sm:text-[48px]">
            Consumer rights,
            <br />
            <span className="text-muted-foreground">grounded in the statute.</span>
          </h1>
          <p className="mt-6 text-[16px] leading-[1.7] text-muted-foreground">
            Guides on security deposit law, subscription cancellation rights,
            demand letter writing, and small claims court &mdash; all citing the
            specific statutes that apply.
          </p>
        </div>
      </section>

      {/* Articles */}
      <section className="border-t border-border bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-6 sm:grid-cols-2">
            {ARTICLES.map((article) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group rounded-2xl border border-border bg-background p-6 transition-all hover:border-foreground/10 hover:shadow-premium"
              >
                <span className="inline-block rounded-full bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  {CATEGORY_LABELS[article.category] ?? article.category}
                </span>
                <h2 className="mt-4 text-[16px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                  {article.title}
                </h2>
                <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground line-clamp-3">
                  {article.description}
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Read article <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border px-6 py-16 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="text-[24px] font-semibold tracking-tight text-foreground">
            Ready to take action?
          </h2>
          <p className="mt-3 text-[15px] text-muted-foreground">
            Subscription cancellation is free. Deposit demand letters start at $49.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/tools/cancel-subscription"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 text-[14px] font-semibold text-white transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              Cancel a Subscription — Free
            </Link>
            <Link
              href="/start?wedge=deposit"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-[14px] font-semibold text-foreground transition-all hover:bg-background active:scale-[0.98]"
            >
              Start Deposit Case
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <Link href="/" className="text-[15px] font-semibold text-foreground">
            Resolvaio
          </Link>
          <p className="mx-auto mt-4 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
            Resolvaio provides writing assistance and general information about
            consumer disputes. It does not provide legal advice, does not
            evaluate claims, and does not guarantee outcomes. Review all content
            before acting. Individual results vary.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <Link href="/legal/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-foreground">Cookies</Link>
            <Link href="/legal/acceptable-use" className="transition-colors hover:text-foreground">Acceptable Use</Link>
            <Link href="/legal/ai-disclosure" className="transition-colors hover:text-foreground">AI Disclosure</Link>
            <Link href="/legal/accessibility" className="transition-colors hover:text-foreground">Accessibility</Link>
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground">
            &copy; {new Date().getFullYear()} Resolvaio. All rights reserved.
            Resolvaio is owned and operated by Nikola Innovations Limited.
          </p>
        </div>
      </footer>
    </main>
  );
}
