import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { fetchSitemapEntries } from '@/lib/sitemapData';

// Self-referencing by whichever domain actually served the request — see robots.ts for why: it's how
// this site can rank under clinicq.praispranav.com today and clinicq.fit later with no env flip.
function siteUrl(): string {
  const host = headers().get('host');
  if (host && !/^(localhost|127\.0\.0\.1)/.test(host)) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = siteUrl();
  const entries = await fetchSitemapEntries(SITE_URL);
  return entries.map((entry) => ({
    url: entry.url,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
