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
    // CA small-claims fees are statewide statutory: $30 (≤$1,500), $50
    // (≤$5,000), $75 (≤$12,500). Verified against official .courts.ca.gov.
    counties: [
      { slug: 'los-angeles-county', name: 'Los Angeles County', courtName: 'Superior Court of California, County of Los Angeles — Small Claims Division', courtUrl: 'https://www.lacourt.ca.gov/pages/lp/small-claims', filingFee: '$30–$75 (by claim amount)', note: 'Free Small Claims Advisor; self-represented e-filing available.', verified: true, sourceUrl: 'https://www.lacourt.ca.gov/pages/lp/small-claims' },
      { slug: 'san-francisco-county', name: 'San Francisco County', courtName: 'Superior Court of California, County of San Francisco — Small Claims', courtUrl: 'https://sf.courts.ca.gov/divisions/civil-division', filingFee: '$30–$75 (by claim amount)', note: 'Small Claims counter at 400 McAllister Street, Room 103.', verified: true, sourceUrl: 'https://sf.courts.ca.gov/divisions/civil-division' },
      { slug: 'san-diego-county', name: 'San Diego County', courtName: 'Superior Court of California, County of San Diego — Small Claims Division', courtUrl: 'https://www.sdcourt.ca.gov/sdcourt/smallclaims2', filingFee: '$30–$75 (by claim amount)', note: 'Small Claims Legal Advisor by phone.', verified: true, sourceUrl: 'https://www.sdcourt.ca.gov/sdcourt/smallclaims2' },
      { slug: 'sacramento-county', name: 'Sacramento County', courtName: 'Superior Court of California, County of Sacramento — Small Claims', courtUrl: 'https://www.saccourt.ca.gov/small-claims/', filingFee: '$30–$75 (by claim amount)', note: 'Filed at the Carol Miller Justice Center; Small Claims Advisory Clinic.', verified: true, sourceUrl: 'https://www.saccourt.ca.gov/small-claims/' },
      { slug: 'orange-county', name: 'Orange County', courtName: 'Superior Court of California, County of Orange — Small Claims', courtUrl: 'https://www.occourts.org/divisions/small-claims', filingFee: '$30–$75 (by claim amount)', note: 'File at the Central Justice Center, Santa Ana; e-file or drop-box.', verified: true, sourceUrl: 'https://www.occourts.org/divisions/small-claims' },
      { slug: 'santa-clara-county', name: 'Santa Clara County', courtName: 'Superior Court of California, County of Santa Clara — Small Claims', courtUrl: 'https://santaclara.courts.ca.gov/self-help/self-help-topics/self-help-small-claims', filingFee: '$30–$75 (by claim amount)', note: 'Small Claims Clerk at the Downtown Superior Court, San Jose.', verified: true, sourceUrl: 'https://santaclara.courts.ca.gov/self-help/self-help-topics/self-help-small-claims' },
    ],
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
    // Texas has no separate small-claims court — claims are filed in Justice of
    // the Peace (JP) courts, limit $20,000 (Gov't Code §27.031). The $54 base
    // filing fee is statewide; service of citation is separate and per-defendant,
    // varying by county. Dallas & Bexar service amounts are verified; Tarrant &
    // Travis carry only the verified $54 base (service add-on unconfirmed).
    // Harris & Collin fee pages were network-blocked from the researcher — both
    // stay verified:false until a human confirms the fee.
    counties: [
      { slug: 'dallas-county', name: 'Dallas County', courtName: 'Dallas County Justice of the Peace Courts (Small Claims)', courtUrl: 'https://www.dallascounty.org/government/jpcourts/', filingFee: '$54 filing + $80 service per defendant (~$134)', note: 'Money-only claims up to $20,000. Mandatory e-filing at JP 1-1 since March 2025 (eFileTexas.gov). File in the precinct where the defendant resides.', verified: true, sourceUrl: 'https://www.dallascounty.org/government/jpcourts/1-1/filing-fees.php' },
      { slug: 'bexar-county', name: 'Bexar County (San Antonio)', courtName: 'Bexar County Justice of the Peace Courts (Small Claims)', courtUrl: 'https://www.bexar.org/3395/Civil-Division', filingFee: '$54 filing + $92 service per party', note: 'Claims up to $20,000 (the county site’s older $10,000 figure is stale). File in the correct precinct; e-file via eFileTexas.gov.', verified: true, sourceUrl: 'https://www.bexar.org/3164/Filing-Fees' },
      { slug: 'tarrant-county', name: 'Tarrant County (Fort Worth)', courtName: 'Tarrant County Justice of the Peace Courts (Small Claims)', courtUrl: 'https://www.tarrantcountytx.gov/en/justices-of-the-peace.html', filingFee: '$54 filing (+ county service of citation)', note: 'Claims up to $20,000. Service of citation is charged separately per defendant — confirm the current amount with the court. File in the correct precinct; e-file via eFileTexas.gov.', verified: true, sourceUrl: 'https://www.tarrantcountytx.gov/en/justices-of-the-peace.html' },
      { slug: 'travis-county', name: 'Travis County (Austin)', courtName: 'Travis County Justice of the Peace Courts (Small Claims)', courtUrl: 'https://www.traviscountytx.gov/justices-of-the-peace', filingFee: '$54 filing (+ county service of citation)', note: 'Claims up to $20,000. Service of citation is charged separately per defendant — confirm the current amount with the court. File in the correct precinct; e-file via eFileTexas.gov.', verified: true, sourceUrl: 'https://www.traviscountytx.gov/justices-of-the-peace' },
      { slug: 'harris-county', name: 'Harris County (Houston)', courtName: 'Harris County Justice of the Peace Courts (Small Claims)', courtUrl: 'https://www.jp.hctx.net/', filingFee: 'Confirm with court', note: 'Claims up to $20,000. Service performed by Harris County Constables (separate per-defendant fee).', verified: false, sourceUrl: 'https://www.jp.hctx.net/civil/filing.htm' },
      { slug: 'collin-county', name: 'Collin County', courtName: 'Collin County Justice of the Peace Courts (Small Claims)', courtUrl: 'https://www.collincountytx.gov/Courts/Justices-Peace/civil-suits', filingFee: '$54 filing + $15 citation + $75 service per defendant (~$144)', note: 'Claims up to $20,000. Four JP precincts; all accept e-filing via eFileTexas.gov. Fees per the county’s FY2026 Adopted Fee Schedule.', verified: true, sourceUrl: 'https://www.collincountytx.gov/docs/default-source/budget-and-finance/documents/fy-2026-adopted-fee-schedule-by-department.pdf' },
    ],
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
    // NYC Civil Court small-claims fee: $15 (≤$1,000) / $20 (>$1,000). NYC
    // boroughs cap at $10,000; Nassau District & Buffalo City courts at $5,000.
    counties: [
      { slug: 'manhattan', name: 'Manhattan (New York County)', courtName: 'NYC Civil Court, Small Claims Part', courtUrl: 'https://ww2.nycourts.gov/courts/nyc/smallclaims/index.shtml', filingFee: '$15–$20 (by claim amount)', note: '111 Centre St; small-claims trials are typically evening ("Night Court").', verified: true, sourceUrl: 'https://www.nycourts.gov/node/1051' },
      { slug: 'brooklyn', name: 'Brooklyn (Kings County)', courtName: 'NYC Civil Court, Small Claims Part', courtUrl: 'https://ww2.nycourts.gov/courts/nyc/smallclaims/index.shtml', filingFee: '$15–$20 (by claim amount)', note: '141 Livingston St, Brooklyn.', verified: true, sourceUrl: 'https://www.nycourts.gov/node/1051' },
      { slug: 'queens', name: 'Queens County', courtName: 'NYC Civil Court, Small Claims Part', courtUrl: 'https://ww2.nycourts.gov/courts/nyc/smallclaims/index.shtml', filingFee: '$15–$20 (by claim amount)', note: '89-17 Sutphin Blvd, Jamaica.', verified: true, sourceUrl: 'https://www.nycourts.gov/node/1051' },
      { slug: 'bronx', name: 'Bronx County', courtName: 'NYC Civil Court, Small Claims Part', courtUrl: 'https://ww2.nycourts.gov/courts/nyc/smallclaims/index.shtml', filingFee: '$15–$20 (by claim amount)', note: '851 Grand Concourse, Bronx.', verified: true, sourceUrl: 'https://www.nycourts.gov/node/1051' },
      { slug: 'nassau-county', name: 'Nassau County', courtName: 'Nassau County District Court, Small Claims Department', courtUrl: 'https://ww2.nycourts.gov/COURTS/10JD/nassau/district-smallclaims.shtml', filingFee: '$15–$20 (claims up to $5,000)', note: 'First District Court, 99 Main Street, Hempstead. Limit $5,000.', verified: true, sourceUrl: 'https://www.nycourts.gov/courts/10th-jd-nassau/nassau-county-district-court/nassau-district-court-case-types' },
      { slug: 'erie-county-buffalo', name: 'Erie County (Buffalo)', courtName: 'Buffalo City Court, Small Claims Part', courtUrl: 'https://ww2.nycourts.gov/courts/8jd/Erie/bccsmclaims.shtml', filingFee: '$15–$20 (claims up to $5,000)', note: '50 Delaware Ave, Buffalo. Limit $5,000. Towns outside Buffalo use Justice Courts ($3,000).', verified: true, sourceUrl: 'https://ww2.nycourts.gov/courts/8jd/Erie/bccsmclaims.shtml' },
    ],
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
    // FL small-claims fees are statewide statutory (§34.041): $55/$80/$175/$300
    // by claim amount. Miami-Dade, Broward, Orange verified against official
    // clerk sources; Palm Beach, Hillsborough, Duval flagged unverified (their
    // official fee pages blocked the crawler — verify before shipping those).
    counties: [
      { slug: 'miami-dade-county', name: 'Miami-Dade County', courtName: 'Miami-Dade County Court, Small Claims Division', courtUrl: 'https://www.miamidadeclerk.gov/clerk/small-claims.page', filingFee: '$55–$300 (by claim amount)', note: 'E-file via the Florida Courts E-Filing Portal.', verified: true, sourceUrl: 'https://www.miamidadeclerk.gov/library/small_claims/881-Web.pdf' },
      { slug: 'broward-county', name: 'Broward County', courtName: 'Broward County Court, County Civil / Small Claims', courtUrl: 'https://www.browardclerk.org/Divisions/CountyCivil', filingFee: '$55–$300 (by claim amount)', note: 'Courthouse: 201 SE 6th St, Fort Lauderdale.', verified: true, sourceUrl: 'https://www.browardclerk.org/GeneralInformation/FeesAndCosts' },
      { slug: 'orange-county', name: 'Orange County (Orlando)', courtName: 'Orange County Court, Small Claims Division', courtUrl: 'https://www.myorangeclerk.com/Divisions/Civil/Small-Claims', filingFee: '$55–$300 (by claim amount)', note: 'Self Help Center; 425 N. Orange Ave., Orlando.', verified: true, sourceUrl: 'https://www.myorangeclerk.com/Divisions/Civil/Small-FAQs' },
      { slug: 'palm-beach-county', name: 'Palm Beach County', courtName: 'Palm Beach County Court, County Civil — Small Claims', courtUrl: 'https://www.mypalmbeachclerk.com/departments/courts/county-civil-court/small-claims', filingFee: '$55–$300 (by claim amount)', verified: false, sourceUrl: 'https://www.mypalmbeachclerk.com/departments/courts/county-civil-court/small-claims' },
      { slug: 'hillsborough-county', name: 'Hillsborough County (Tampa)', courtName: 'Hillsborough County Court, Small Claims', courtUrl: 'https://hillsclerk.com/About-Us/Fees-and-Fines', filingFee: '$55–$300 (by claim amount)', verified: false, sourceUrl: 'https://hillsclerk.com/About-Us/Fees-and-Fines' },
      { slug: 'duval-county', name: 'Duval County (Jacksonville)', courtName: 'Duval County Court, Small Claims', courtUrl: 'https://www.duvalclerk.com/departments/civil-court-services/small-claims', filingFee: '$55–$300 (by claim amount)', verified: false, sourceUrl: 'https://www.duvalclerk.com/about/fee-schedules' },
    ],
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
