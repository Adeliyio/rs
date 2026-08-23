import { z } from 'zod';

/**
 * The validated SEO data layer — one source of truth for titles, descriptions,
 * priorities, jurisdictions, verticals, and county pages. Sitemap, robots,
 * schema, metadata, and /llms.txt all read from here, so they cannot drift out
 * of sync with each other or with reality.
 *
 * Every string here is copy that ships to search engines. The zod schemas below
 * enforce the SEO rules AT CONSTRUCTION (no brand in the title, description
 * length) so a broken field is caught when this module loads, not by a crawler.
 */

/* ------------------------------------------------------------------ */
/*  SEO field rules — enforced on the data itself                     */
/* ------------------------------------------------------------------ */

const BRAND = 'Resolvaio';

/** A title tag: the competitive phrase, never the brand (the layout appends it). */
const titleSchema = z
  .string()
  .min(10)
  .max(65, 'Title should be ≤65 chars so it is not truncated in the SERP')
  .refine(
    (t) => !t.toLowerCase().includes(BRAND.toLowerCase()),
    'Title must not contain the brand — the layout template appends "| Resolvaio" once',
  );

/** A meta description: ≤165 chars so it is not truncated. */
const descriptionSchema = z
  .string()
  .min(40)
  .max(165, 'Description should be ≤165 chars so it is not truncated in the SERP');

/* ------------------------------------------------------------------ */
/*  Page + jurisdiction + county schemas                              */
/* ------------------------------------------------------------------ */

const pageSchema = z.object({
  path: z.string().startsWith('/'),
  title: titleSchema,
  description: descriptionSchema,
  priority: z.number().min(0).max(1),
  changeFrequency: z.enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']),
});
export type SeoPage = z.infer<typeof pageSchema>;

const countySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),          // "Los Angeles County"
  courtName: z.string(),     // official small-claims court
  courtUrl: z.string().url(),
  filingFee: z.string(),     // human string, may be a range
  note: z.string().optional(),
  /** false until a human verifies the facts — a page NEVER ships while unverified. */
  verified: z.boolean(),
  sourceUrl: z.string().url().optional(),
});
export type SeoCounty = z.infer<typeof countySchema>;

const jurisdictionSchema = z.object({
  code: z.enum(['CA', 'TX', 'NY', 'FL']),
  slug: z.string(),          // "california"
  name: z.string(),          // "California"
  statuteCitation: z.string(),
  statuteUrl: z.string().url(),
  returnDeadlineDays: z.number(),
  smallClaimsLimit: z.string(),
  page: pageSchema,
  counties: z.array(countySchema),
});
export type SeoJurisdiction = z.infer<typeof jurisdictionSchema>;

/* ------------------------------------------------------------------ */
/*  The config                                                        */
/* ------------------------------------------------------------------ */

export const SITE = {
  name: BRAND,
  legalName: 'Resolvaio',
  tagline: 'Demand letters and cancellation emails grounded in verified US consumer-protection law.',
  /** For the AI-disclosure requirement — Resolvaio is a writing tool, not a law firm. */
  aiDisclosure:
    'Resolvaio is an AI-assisted writing and research tool. It is not a law firm and does not provide legal advice.',
  supportEmail: 'support@resolvaio.com',
} as const;

/**
 * Deposit jurisdictions Resolvaio actually serves. Statute facts sourced from
 * the KB. `counties` start empty + unverified — populated from the county
 * research, and each county page ships only when `verified: true`.
 */
const RAW_JURISDICTIONS: SeoJurisdiction[] = [
  {
    code: 'CA',
    slug: 'california',
    name: 'California',
    statuteCitation: 'Cal. Civ. Code § 1950.5',
    statuteUrl: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5.',
    returnDeadlineDays: 21,
    smallClaimsLimit: '$12,500',
    page: {
      path: '/deposit/california',
      title: 'Get your security deposit back in California',
      description:
        'California landlords must return your deposit within 21 days (Civ. Code § 1950.5). Generate a statute-cited demand letter and small-claims packet.',
      priority: 0.9,
      changeFrequency: 'monthly',
    },
    counties: [],
  },
  {
    code: 'TX',
    slug: 'texas',
    name: 'Texas',
    statuteCitation: 'Tex. Prop. Code § 92.103',
    statuteUrl: 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm',
    returnDeadlineDays: 30,
    smallClaimsLimit: '$20,000',
    page: {
      path: '/deposit/texas',
      title: 'Get your security deposit back in Texas',
      description:
        'Texas landlords must refund your deposit within 30 days (Prop. Code § 92.103). Generate a statute-cited demand letter and JP-court filing packet.',
      priority: 0.9,
      changeFrequency: 'monthly',
    },
    counties: [],
  },
  {
    code: 'NY',
    slug: 'new-york',
    name: 'New York',
    statuteCitation: 'N.Y. Gen. Oblig. Law § 7-108',
    statuteUrl: 'https://www.nysenate.gov/legislation/laws/GOB/7-108',
    returnDeadlineDays: 14,
    smallClaimsLimit: '$10,000 (NYC)',
    page: {
      path: '/deposit/new-york',
      title: 'Get your security deposit back in New York',
      description:
        'New York landlords must return your deposit within 14 days (Gen. Oblig. Law § 7-108). Generate a statute-cited demand letter and small-claims packet.',
      priority: 0.9,
      changeFrequency: 'monthly',
    },
    counties: [],
  },
  {
    code: 'FL',
    slug: 'florida',
    name: 'Florida',
    statuteCitation: 'Fla. Stat. § 83.49',
    statuteUrl: 'http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/Sections/0083.49.html',
    returnDeadlineDays: 15,
    smallClaimsLimit: '$8,000',
    page: {
      path: '/deposit/florida',
      title: 'Get your security deposit back in Florida',
      description:
        'Florida landlords must return your deposit within 15 days or send a claim within 30 (Fla. Stat. § 83.49). Generate a statute-cited demand letter.',
      priority: 0.9,
      changeFrequency: 'monthly',
    },
    counties: [],
  },
];

export const JURISDICTIONS: SeoJurisdiction[] = z
  .array(jurisdictionSchema)
  .parse(RAW_JURISDICTIONS);

/** Subscription-cancellation verticals (the free wedge). */
export const VERTICALS: SeoPage[] = z.array(pageSchema).parse([
  { path: '/cancel/gym', title: 'How to cancel a gym membership that won’t let you quit', description: 'Cancel a gym membership using the FTC ROSCA and your state’s cancellation law. Generate a 3-step cancellation email sequence — free.', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/cancel/telecom', title: 'How to cancel a phone or internet contract early', description: 'Cancel a telecom contract citing the FTC’s Click-to-Cancel rule and state law. Generate a citation-backed cancellation sequence — free.', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/cancel/saas', title: 'How to cancel a SaaS subscription you can’t turn off', description: 'Cancel a software subscription with a demand grounded in ROSCA and consumer-protection law. Generate the cancellation emails — free.', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/cancel/streaming', title: 'How to cancel a streaming subscription and stop charges', description: 'Cancel a streaming service and stop recurring charges using ROSCA and state law. Generate a 3-step cancellation sequence — free.', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/cancel/mobile-app', title: 'How to cancel an app subscription that keeps billing', description: 'Cancel an app-store subscription that won’t stop billing, citing ROSCA and app-store rules. Generate the cancellation emails — free.', priority: 0.7, changeFrequency: 'monthly' },
]);

/** Free-standing marketing + tool pages. */
export const STATIC_PAGES: SeoPage[] = z.array(pageSchema).parse([
  { path: '/', title: 'Demand your deposit back. Cancel the subscription. Cite the law.', description: 'Demand letters and cancellation emails grounded in verified US consumer-protection statutes. Security deposits in CA, TX, NY, FL; subscriptions nationwide.', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/deposit', title: 'How to get your security deposit back with a demand letter', description: 'A statute-cited demand letter is the first step to recovering a withheld deposit. Supported in California, Texas, New York, and Florida.', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/subscription', title: 'How to cancel any subscription that won’t let you quit', description: 'Cancel unwanted subscriptions with emails citing the FTC ROSCA rule and your state’s law. A free 3-step sequence for all 50 states.', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/tools/cancel-subscription', title: 'Free subscription cancellation letter generator', description: 'Generate a free, citation-backed cancellation email for any subscription. Grounded in the FTC ROSCA rule and state consumer-protection law.', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/tools/deposit-deadline', title: 'Security deposit return deadline calculator by state', description: 'Find out exactly when your landlord must return your deposit — the statutory deadline for California, Texas, New York, and Florida.', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/about', title: 'How our verified-statute writing assistance works', description: 'How we draft demand letters and cancellation emails grounded in verified primary legal sources, not generative guesses.', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/blog', title: 'Security deposit and subscription cancellation guides', description: 'Plain-English guides to getting your deposit back and cancelling subscriptions, grounded in the statutes that actually apply.', priority: 0.8, changeFrequency: 'weekly' },
]);

/** Legal pages — indexable but low priority. */
export const LEGAL_PAGES = [
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
  '/legal/acceptable-use',
  '/legal/ai-disclosure',
  '/legal/accessibility',
] as const;

/* ------------------------------------------------------------------ */
/*  Doorway-page gate (the Yardstick's 30-warn / 50-stop rule)        */
/* ------------------------------------------------------------------ */

/** Only VERIFIED county pages ship. */
export function shippableCounties(j: SeoJurisdiction): SeoCounty[] {
  return j.counties.filter((c) => c.verified);
}

/** Total verified location (county) pages across all jurisdictions. */
export function locationPageCount(): number {
  return JURISDICTIONS.reduce((n, j) => n + shippableCounties(j).length, 0);
}

/**
 * Enforce the doorway-page gate. Warn at 30, hard-error at 50 — a templated
 * location page must earn its place with unique local value.
 */
export function assertLocationGate(): void {
  const count = locationPageCount();
  if (count >= 50) {
    throw new Error(
      `[seo] ${count} location pages exceeds the hard cap of 50. Each must carry ` +
        'unique, verified local value or it is a doorway page. Prune or justify.',
    );
  }
  if (count >= 30 && process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      `[seo] ${count} location pages — past the 30-page warning line. Confirm each ` +
        'still carries genuinely unique local value before adding more.',
    );
  }
}
