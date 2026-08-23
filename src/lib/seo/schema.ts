import { absoluteUrl, siteUrl } from './site';
import { SITE } from './config';

/**
 * JSON-LD (Schema.org) builders — all derived from seo/config so structured
 * data can NEVER contradict the visible page. Every fact here is verifiable:
 * the legal name, real URL, support contact, the honest AI disclosure. No
 * invented employee counts, ratings, founding dates, or areaServed we don't
 * actually serve.
 *
 * Schema hygiene (2026): Breadcrumb still earns a SERP feature — worth adding
 * across the templated hierarchy. FAQPage rich results were RETIRED by Google
 * for all sites in 2026, so we do not add FAQPage expecting a feature. HowTo is
 * deprecated — never used.
 */

interface JsonLd {
  '@context': 'https://schema.org';
  [k: string]: unknown;
}

/** Organization — the entity Resolvaio is. */
export function organizationSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl()}/#organization`,
    name: SITE.legalName,
    url: siteUrl(),
    logo: absoluteUrl('/icon.svg'),
    description: SITE.tagline,
    // Honest AI disclosure — Resolvaio is a writing tool, not a law firm.
    disambiguatingDescription: SITE.aiDisclosure,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SITE.supportEmail,
      areaServed: 'US',
    },
  };
}

/** WebSite — enables the site name in results. */
export function websiteSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl()}/#website`,
    url: siteUrl(),
    name: SITE.name,
    description: SITE.tagline,
    publisher: { '@id': `${siteUrl()}/#organization` },
  };
}

/**
 * Service schema for a deposit jurisdiction page. `areaServed` is the real
 * state — set ONLY on a state/county page, never guessed nationally. The free
 * subscription offer is marked price "0" because it genuinely is free.
 */
export function depositServiceSchema(args: {
  stateName: string;
  path: string;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Security deposit demand letter — ${args.stateName}`,
    serviceType: 'Legal document writing assistance',
    provider: { '@id': `${siteUrl()}/#organization` },
    areaServed: { '@type': 'State', name: args.stateName },
    url: absoluteUrl(args.path),
    offers: {
      '@type': 'Offer',
      price: '49',
      priceCurrency: 'USD',
    },
  };
}

export function freeCancellationServiceSchema(path: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Subscription cancellation letter generator',
    serviceType: 'Consumer document writing assistance',
    provider: { '@id': `${siteUrl()}/#organization` },
    areaServed: 'US',
    url: absoluteUrl(path),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

/**
 * Breadcrumb — the one schema still earning a SERP feature. Pass the trail as
 * [{name, path}] from Home to the current page.
 */
export function breadcrumbSchema(trail: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
