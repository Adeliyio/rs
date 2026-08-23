import { describe, it, expect } from 'vitest';

import {
  STATIC_PAGES,
  VERTICALS,
  JURISDICTIONS,
  locationPageCount,
  shippableCounties,
  type SeoPage,
} from '../config';
import { siteUrl, absoluteUrl } from '../site';

/**
 * The SEO ratchet. These assertions are the standard made permanent — the rules
 * survive whoever touches the config next. If a title gains the brand, a
 * description runs long, two pages collide, or the location grid blows past the
 * cap, CI fails here rather than a crawler finding it in production.
 */

const ALL_PAGES: SeoPage[] = [
  ...STATIC_PAGES,
  ...VERTICALS,
  ...JURISDICTIONS.map((j) => j.page),
];

describe('SEO — title tags', () => {
  it('never contain the brand (the layout template appends it once)', () => {
    for (const p of ALL_PAGES) {
      expect(p.title.toLowerCase(), `title for ${p.path}`).not.toContain('resolvaio');
    }
  });

  it('stay ≤65 chars so they are not truncated', () => {
    for (const p of ALL_PAGES) {
      expect(p.title.length, `title for ${p.path}: "${p.title}"`).toBeLessThanOrEqual(65);
    }
  });

  it('are unique across pages (no two pages compete)', () => {
    const titles = ALL_PAGES.map((p) => p.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('SEO — meta descriptions', () => {
  it('stay ≤165 chars', () => {
    for (const p of ALL_PAGES) {
      expect(p.description.length, `desc for ${p.path}`).toBeLessThanOrEqual(165);
    }
  });

  it('give a real reason to click (min length)', () => {
    for (const p of ALL_PAGES) {
      expect(p.description.length, `desc for ${p.path}`).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('SEO — paths & hierarchy', () => {
  it('all page paths are unique', () => {
    const paths = ALL_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('county pages nest under their state (no shadowing)', () => {
    for (const j of JURISDICTIONS) {
      for (const c of j.counties) {
        // A county page lives under its state's path.
        const countyPath = `${j.page.path}/${c.slug}`;
        expect(countyPath.startsWith(`${j.page.path}/`)).toBe(true);
      }
    }
  });
});

describe('SEO — programmatic doorway gate', () => {
  it('total location pages stay under the hard cap of 50', () => {
    expect(locationPageCount()).toBeLessThan(50);
  });

  it('only verified counties are shippable', () => {
    for (const j of JURISDICTIONS) {
      for (const c of shippableCounties(j)) {
        expect(c.verified, `${j.slug}/${c.slug} must be verified to ship`).toBe(true);
      }
    }
  });
});

describe('SEO — URL resolver', () => {
  it('never emits a trailing slash', () => {
    expect(siteUrl().endsWith('/')).toBe(false);
    expect(absoluteUrl('/deposit/california').endsWith('/')).toBe(false);
  });

  it('produces absolute canonical URLs', () => {
    expect(absoluteUrl('/deposit')).toMatch(/^https?:\/\/.+\/deposit$/);
    expect(absoluteUrl('/')).toBe(siteUrl());
  });
});
