import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/seo/site';

/**
 * robots.txt — points at the sitemap and disallows what shouldn't be crawled.
 *
 * AI + search crawlers are named EXPLICITLY (not just `*`) so a future
 * tightening of the wildcard can't silently cut off discovery, and so we can
 * reason about each one. All rules share the same disallow set: the app's
 * private surface (which lives on app.resolvaio.com anyway) + the API.
 */

const DISALLOW = ['/api/', '/admin/', '/case/', '/new', '/settings'];

const CRAWLERS = [
  // Search
  'Googlebot',
  'Googlebot-Image',
  'Bingbot',
  'DuckDuckBot',
  'Applebot',
  // AI assistants (a growing slice of "how do I get my deposit back" discovery)
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'PerplexityBot',
  'CCBot',
  'Google-Extended',
];

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow: DISALLOW })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
