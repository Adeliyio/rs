/**
 * The single URL resolver — the one true address for the site.
 *
 * EVERY absolute link, canonical, OG tag, sitemap entry, robots sitemap ref,
 * and JSON-LD @id derives from here. Never hardcode the domain anywhere else.
 * Production cutover is a single env change (NEXT_PUBLIC_SITE_URL), not a hunt
 * through the codebase.
 *
 * A blank env degrades to the real production domain WITH A WARNING, rather
 * than shipping a staging URL into the search index.
 */

const PRODUCTION_URL = 'https://resolvaio.com';

let warned = false;

/** Absolute base site URL, no trailing slash. */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    '';

  if (!raw) {
    if (!warned && process.env.NODE_ENV === 'production') {
      warned = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[seo] NEXT_PUBLIC_SITE_URL is not set — falling back to ${PRODUCTION_URL}. ` +
          'Set it explicitly for the environment to avoid indexing the wrong host.',
      );
    }
    return PRODUCTION_URL;
  }

  // The app runs on app.<domain> but marketing/SEO lives on the root domain.
  // If someone points this at the app subdomain, normalise to the root so
  // canonicals never point at the app host.
  const noSlash = raw.replace(/\/+$/, '');
  return noSlash;
}

/** Build an absolute URL for a site-relative path (leading slash optional). */
export function absoluteUrl(path = ''): string {
  const base = siteUrl();
  if (!path || path === '/') return base;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

/** The marketing host used for the app-subdomain noindex split. */
export function appHostname(): string {
  return process.env.APP_HOSTNAME ?? 'app.resolvaio.com';
}
