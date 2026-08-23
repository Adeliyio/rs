import type { Metadata } from 'next';

import { absoluteUrl } from './site';
import { SITE } from './config';

/**
 * buildMetadata() — every page's generateMetadata / metadata should route
 * through here so the SEO rules are enforced in ONE place:
 *
 * - canonical derived from siteUrl() (never hardcoded)
 * - title is the competitive phrase and NEVER the brand (the root layout's
 *   template `%s | Resolvaio` appends it exactly once)
 * - description trimmed to ≤165 chars (warns rather than silently truncating)
 * - OG + Twitter filled from the same title/description
 *
 * This is where the double-branding bug (`… | Resolvaio | Resolvaio`) dies.
 */

const MAX_DESC = 165;
const BRAND = SITE.name;

export interface BuildMetadataInput {
  title: string;
  description: string;
  /** Site-relative path, e.g. "/deposit/california". */
  path: string;
  /** Set false for pages that must never be indexed (private/app). Default true. */
  index?: boolean;
  /** Optional OG image path (absolute-ised). */
  ogImage?: string;
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const { title, description, path, index = true, ogImage } = input;

  // Guard: the layout template adds "| Resolvaio"; a page-level title must not.
  if (title.toLowerCase().includes(BRAND.toLowerCase())) {
    // eslint-disable-next-line no-console
    console.warn(
      `[seo] Page title for "${path}" contains "${BRAND}". The layout template ` +
        'appends it once — remove it from the page title to avoid double-branding.',
    );
  }

  let desc = description;
  if (desc.length > MAX_DESC) {
    // eslint-disable-next-line no-console
    console.warn(
      `[seo] Description for "${path}" is ${desc.length} chars (>${MAX_DESC}); trimming.`,
    );
    desc = desc.slice(0, MAX_DESC - 1).trimEnd() + '…';
  }

  const canonical = absoluteUrl(path);

  return {
    title,
    description: desc,
    alternates: { canonical },
    robots: index
      ? undefined
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'website',
      siteName: BRAND,
      locale: 'en_US',
      url: canonical,
      title,
      description: desc,
      ...(ogImage ? { images: [{ url: absoluteUrl(ogImage) }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      ...(ogImage ? { images: [absoluteUrl(ogImage)] } : {}),
    },
  };
}
