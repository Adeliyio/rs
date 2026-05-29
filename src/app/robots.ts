import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/case/', '/new', '/settings'],
      },
    ],
    sitemap: 'https://resolvaio.com/sitemap.xml',
  };
}
