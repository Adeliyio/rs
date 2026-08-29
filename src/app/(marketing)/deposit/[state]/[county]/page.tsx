import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Scale, Clock, Building2, MapPin } from 'lucide-react';

import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbSchema, depositServiceSchema } from '@/lib/seo/schema';
import { JURISDICTIONS, shippableCounties, type SeoJurisdiction, type SeoCounty } from '@/lib/seo/config';
import { safeJsonLd } from '@/lib/safe-json-ld';

/**
 * Programmatic deposit county pages — /deposit/{state}/{county}.
 *
 * Generated from seo/config, but NOT interchangeable: each carries that county's
 * real court, filing fee, and the state's statutory deadline — information a
 * person in that county genuinely wants. Passes the doorway test: it would exist
 * if only one person ever searched for it.
 *
 * Only VERIFIED counties are built (generateStaticParams filters on it), so an
 * unverified fact never ships. Nested under the state so it can't shadow the
 * state term.
 */

function resolve(stateSlug: string, countySlug: string):
  | { j: SeoJurisdiction; c: SeoCounty }
  | null {
  const j = JURISDICTIONS.find((x) => x.slug === stateSlug);
  if (!j) return null;
  const c = shippableCounties(j).find((x) => x.slug === countySlug);
  if (!c) return null;
  return { j, c };
}

export function generateStaticParams(): { state: string; county: string }[] {
  return JURISDICTIONS.flatMap((j) =>
    shippableCounties(j).map((c) => ({ state: j.slug, county: c.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; county: string }>;
}): Promise<Metadata> {
  const { state, county } = await params;
  const r = resolve(state, county);
  if (!r) return { title: 'Not found' };
  const { j, c } = r;

  // Title & description authored to fit the SERP limits (≤65 / ≤165) rather than
  // relying on buildMetadata's trim — a mid-word cut reads as sloppy. Worst-case
  // county+state substitutions here stay well under both caps.
  const title = `Security deposit small claims in ${c.name}`.slice(0, 65);
  const description =
    `Recover your security deposit in ${c.name}. ${j.name} landlords must return ` +
    `it within ${j.returnDeadlineDays} days — generate a statute-cited demand letter.`;

  return buildMetadata({
    title,
    description,
    path: `${j.page.path}/${c.slug}`,
  });
}

export default async function CountyDepositPage({
  params,
}: {
  params: Promise<{ state: string; county: string }>;
}): Promise<React.JSX.Element> {
  const { state, county } = await params;
  const r = resolve(state, county);
  if (!r) notFound();
  const { j, c } = r;

  const breadcrumb = breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Security Deposit', path: '/deposit' },
    { name: j.name, path: j.page.path },
    { name: c.name, path: `${j.page.path}/${c.slug}` },
  ]);
  const service = depositServiceSchema({ stateName: j.name, path: `${j.page.path}/${c.slug}` });

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-4xl px-6 py-16">
        {/* Breadcrumb (visible) */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
          <Link href="/deposit" className="hover:text-neutral-700">Security Deposit</Link>
          <span>/</span>
          <Link href={j.page.path} className="hover:text-neutral-700">{j.name}</Link>
          <span>/</span>
          <span className="text-neutral-700">{c.name}</span>
        </nav>

        <h1 className="mt-5 text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Get your security deposit back in {c.name}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-neutral-600">
          {j.name} landlords must return your deposit within{' '}
          <strong>{j.returnDeadlineDays} days</strong> of move-out under{' '}
          <strong>{j.statuteCitation}</strong>. If yours didn&apos;t, a statute-cited
          demand letter is the first step — and if they still ignore you, you can
          file in small claims court in {c.name}.
        </p>

        <div className="mt-8">
          <Link
            href="/start?wedge=deposit"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Start your {j.name} demand letter <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* County-specific facts — the unique value that makes this not a doorway page */}
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 p-5">
            <Clock className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-semibold text-neutral-900">Return deadline</p>
            <p className="mt-1 text-sm text-neutral-600">{j.returnDeadlineDays} days ({j.statuteCitation})</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-5">
            <Building2 className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-semibold text-neutral-900">Small claims court</p>
            <p className="mt-1 text-sm text-neutral-600">{c.courtName}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-5">
            <Scale className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-semibold text-neutral-900">Filing fee</p>
            <p className="mt-1 text-sm text-neutral-600">
              {c.filingFee} · claims up to {j.smallClaimsLimit}
            </p>
          </div>
        </div>

        {c.note && (
          <div className="mt-6 flex items-start gap-3 rounded-xl bg-neutral-50 p-5">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
            <p className="text-sm text-neutral-600">{c.note}</p>
          </div>
        )}

        <div className="mt-8 text-sm">
          <a
            href={c.courtUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {c.name} small claims court — official site →
          </a>
        </div>

        <p className="mt-12 max-w-2xl text-xs leading-relaxed text-neutral-400">
          Resolvaio is a writing and research assistance tool, not a law firm, and
          does not offer legal opinions or representation. Court facts are provided
          for convenience — confirm current filing details with the court before filing.
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(service) }} />
    </main>
  );
}
