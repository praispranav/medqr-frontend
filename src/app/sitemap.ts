import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

// Self-referencing by whichever domain actually served the request — see robots.ts for why: it's how
// this site can rank under clinicq.praispranav.com today and clinicq.fit later with no env flip.
function siteUrl(): string {
  const host = headers().get('host');
  if (host && !/^(localhost|127\.0\.0\.1)/.test(host)) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = siteUrl();
  const base: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/doctors`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/clinics`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/for-clinics`, changeFrequency: 'weekly', priority: 0.8 }, // Decision 58: the clinic marketing page
    { url: `${SITE_URL}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const res = await fetch(`${API_BASE}/directory/sitemap`, { next: { revalidate: 3600 } });
    if (!res.ok) return base;
    const { doctors, clinics } = (await res.json()) as { doctors: { slug: string; updated_at: string }[]; clinics: { slug: string }[] };
    return [
      ...base,
      ...doctors.map((d) => ({ url: `${SITE_URL}/doctors/${d.slug}`, lastModified: d.updated_at, changeFrequency: 'weekly' as const, priority: 0.7 })),
      ...clinics.map((c) => ({ url: `${SITE_URL}/clinics/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ];
  } catch {
    return base;
  }
}
