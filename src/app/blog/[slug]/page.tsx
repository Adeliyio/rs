import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { getArticleBySlug, getAllSlugs, ARTICLES } from '@/lib/blog/articles';
import { ToolsDropdown } from '@/components/marketing/tools-dropdown';
import { safeJsonLd } from '@/lib/safe-json-ld';

/* ------------------------------------------------------------------ */
/*  Static params for build-time generation                           */
/* ------------------------------------------------------------------ */

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                          */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return { title: 'Article Not Found' };
  }

  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: `${article.title} | Resolvaio`,
      description: article.description,
      type: 'article',
      publishedTime: article.publishedAt,
      locale: 'en_US',
      siteName: 'Resolvaio',
    },
    twitter: {
      card: 'summary',
      title: article.title,
      description: article.description,
    },
    alternates: {
      canonical: `https://resolvaio.com/blog/${slug}`,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  'deposit-state': 'Security Deposit',
  'deposit-general': 'Deposit Recovery',
  subscription: 'Subscription Cancellation',
  'consumer-rights': 'Consumer Rights',
};

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  // Find related articles (same category, exclude current)
  const related = ARTICLES
    .filter((a) => a.category === article.category && a.slug !== article.slug)
    .slice(0, 3);

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

      {/* Article */}
      <article className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#8A8A8A] transition-colors hover:text-[#111]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All articles
          </Link>

          {/* Category + date */}
          <div className="mt-8 flex items-center gap-3">
            <span className="rounded-full bg-white border border-[#E8E8E5] px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-[#8A8A8A]">
              {CATEGORY_LABELS[article.category] ?? article.category}
            </span>
            <span className="text-[12px] text-[#8A8A8A]">
              {new Date(article.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>

          {/* Title */}
          <h1 className="mt-6 text-[28px] font-semibold leading-[1.2] tracking-tight text-[#111] sm:text-[36px]">
            {article.title}
          </h1>

          {/* Description */}
          <p className="mt-4 text-[16px] leading-[1.7] text-[#5F5F5F]">
            {article.description}
          </p>

          {/* Sections */}
          <div className="mt-12 space-y-10">
            {article.sections.map((section, i) => (
              <div key={i}>
                {section.heading && (
                  <h2 className="mb-4 text-[20px] font-semibold text-[#111]">
                    {section.heading}
                  </h2>
                )}
                <div className="text-[15px] leading-[1.8] text-[#5F5F5F] whitespace-pre-line">
                  {section.body}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-16 rounded-2xl border border-[#E8E8E5] bg-white p-8 text-center">
            <h3 className="text-[18px] font-semibold text-[#111]">
              Ready to take the next step?
            </h3>
            <p className="mt-2 text-[14px] text-[#5F5F5F]">
              Generate a demand letter or cancellation email sequence grounded in
              the statutes discussed in this article.
            </p>
            <Link
              href={article.ctaHref}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#111] px-6 py-3 text-[14px] font-semibold text-white transition-all hover:bg-[#222] active:scale-[0.98]"
            >
              {article.ctaText} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Disclaimer */}
          <p className="mt-10 text-[12px] leading-relaxed text-[#8A8A8A]">
            This article provides general information about consumer protection
            statutes. It does not constitute legal advice and does not evaluate
            specific claims. Statutes may be amended; verify current law with
            official sources. Consider consulting a licensed attorney for advice
            about your specific situation.
          </p>
        </div>
      </article>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="border-t border-[#E8E8E5] bg-white px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-[16px] font-semibold text-[#111]">
              Related articles
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group rounded-2xl border border-[#E8E8E5] bg-[#F7F7F5] p-5 transition-all hover:border-[#111]/10 hover:shadow-premium"
                >
                  <h3 className="text-[14px] font-semibold leading-snug text-[#111] group-hover:text-primary transition-colors line-clamp-2">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-[12px] leading-[1.5] text-[#5F5F5F] line-clamp-2">
                    {r.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-[#E8E8E5] px-6 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <Link href="/" className="text-[15px] font-semibold text-[#111]">
            Resolvaio
          </Link>
          <p className="mx-auto mt-4 max-w-2xl text-[12px] leading-relaxed text-[#8A8A8A]">
            Writing assistance grounded in verified consumer protection law.
            Not legal advice. Not a law firm.
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

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: article.title,
            description: article.description,
            datePublished: article.publishedAt,
            dateModified: article.publishedAt,
            inLanguage: 'en-US',
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `https://resolvaio.com/blog/${slug}`,
            },
            author: {
              '@type': 'Organization',
              name: 'Resolvaio',
              url: 'https://resolvaio.com',
            },
            publisher: {
              '@type': 'Organization',
              name: 'Resolvaio',
              url: 'https://resolvaio.com',
            },
            about: {
              '@type': 'Thing',
              name: 'US Consumer Protection Law',
            },
          }),
        }}
      />

      {/* JSON-LD: BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: 'https://resolvaio.com',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Blog',
                item: 'https://resolvaio.com/blog',
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: article.title,
                item: `https://resolvaio.com/blog/${slug}`,
              },
            ],
          }),
        }}
      />
    </main>
  );
}
