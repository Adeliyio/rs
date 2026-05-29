import type { MetadataRoute } from 'next';

import { getAllSlugs } from '@/lib/blog/articles';

const BASE_URL = 'https://resolvaio.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  /* ---- Static pages ---- */
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },

    // Deposit marketing pages
    { url: `${BASE_URL}/deposit`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/deposit/california`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/deposit/texas`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/deposit/new-york`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/deposit/florida`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },

    // Subscription marketing
    { url: `${BASE_URL}/subscription`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },

    // Tools
    { url: `${BASE_URL}/tools/cancel-subscription`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/tools/deposit-deadline`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },

    // Cancel verticals
    { url: `${BASE_URL}/cancel/gym`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/cancel/telecom`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/cancel/saas`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/cancel/streaming`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/cancel/mobile-app`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },

    // Legal pages
    { url: `${BASE_URL}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/acceptable-use`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/ai-disclosure`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/accessibility`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  /* ---- Blog articles ---- */
  const blogPages: MetadataRoute.Sitemap = getAllSlugs().map((slug) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...blogPages];
}
