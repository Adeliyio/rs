import type { MetadataRoute } from 'next';

import { getAllSlugs } from '@/lib/blog/articles';
import { absoluteUrl } from '@/lib/seo/site';
import {
  STATIC_PAGES,
  VERTICALS,
  JURISDICTIONS,
  LEGAL_PAGES,
  shippableCounties,
  assertLocationGate,
} from '@/lib/seo/config';

/**
 * Sitemap — the guest list of everything we want indexed, derived entirely from
 * seo/config + siteUrl(). It deliberately EXCLUDES the private app surface
 * (/app, /case, /new, /admin, /settings) — their absence is intentional.
 *
 * lastmod is the BUILD time: a rebuild is the moment content could have changed,
 * so it's accurate, not guessed. County pages are nested BELOW their state
 * (priority 0.7 vs 0.9) so a county slug can never shadow the state term, and
 * only VERIFIED counties ship.
 */

const BUILD_TIME = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  // Enforce the doorway-page gate at build time.
  assertLocationGate();

  const entries: MetadataRoute.Sitemap = [];

  /* ---- Static + tool + marketing pages ---- */
  for (const p of STATIC_PAGES) {
    entries.push({
      url: absoluteUrl(p.path),
      lastModified: BUILD_TIME,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    });
  }

  /* ---- Subscription verticals ---- */
  for (const p of VERTICALS) {
    entries.push({
      url: absoluteUrl(p.path),
      lastModified: BUILD_TIME,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    });
  }

  /* ---- Deposit jurisdictions + their verified county pages ---- */
  for (const j of JURISDICTIONS) {
    entries.push({
      url: absoluteUrl(j.page.path),
      lastModified: BUILD_TIME,
      changeFrequency: j.page.changeFrequency,
      priority: j.page.priority, // 0.9 — the parent term
    });
    for (const c of shippableCounties(j)) {
      entries.push({
        url: absoluteUrl(`${j.page.path}/${c.slug}`),
        lastModified: BUILD_TIME,
        changeFrequency: 'monthly',
        priority: 0.7, // nested below the state so it never shadows it
      });
    }
  }

  /* ---- Legal pages ---- */
  for (const path of LEGAL_PAGES) {
    entries.push({
      url: absoluteUrl(path),
      lastModified: BUILD_TIME,
      changeFrequency: 'yearly',
      priority: 0.3,
    });
  }

  /* ---- Blog articles ---- */
  for (const slug of getAllSlugs()) {
    entries.push({
      url: absoluteUrl(`/blog/${slug}`),
      lastModified: BUILD_TIME,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  return entries;
}
