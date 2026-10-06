import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://medqr.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/manage/',     // Keep admin areas out of search
        '/owner/',      // Keep platform admin out of search
        '/patient/',    // Keep patient queue tickets out of search
        '/doctor/'      // Keep doctor dashboards out of search
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
