import type { DirectorySitemap } from '@/lib/api';
import { placeSlug } from '@/lib/specialtyGroups';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export interface SitemapEntry {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export async function fetchSitemapEntries(siteUrl: string): Promise<SitemapEntry[]> {
  const base: SitemapEntry[] = [
    { url: `${siteUrl}/`, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${siteUrl}/doctors`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/clinics`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/for-clinics`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteUrl}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const res = await fetch(`${API_BASE}/directory/sitemap`, { cache: 'no-store' });
    if (!res.ok) return base;
    const { doctors, clinics, cities = [], groups = [], pairs = [] } = (await res.json()) as DirectorySitemap;
    const landing = (path: string, priority: number) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: 'daily' as const,
      priority,
    });
    return [
      ...base,
      ...cities.map((c) => landing(`/doctors/in/${placeSlug(c.city)}`, 0.9)),
      ...cities.map((c) => landing(`/clinics/in/${placeSlug(c.city)}`, 0.8)),
      ...groups.map((g) => landing(`/doctors/specialty/${g.group}`, 0.8)),
      ...pairs.map((p) => landing(`/doctors/in/${placeSlug(p.city)}/${p.group}`, 0.85)),
      ...doctors.map((d) => ({
        url: `${siteUrl}/doctors/${d.slug}`,
        lastModified: d.updated_at,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
      ...clinics.map((c) => ({
        url: `${siteUrl}/clinics/${c.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return base;
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function generateSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const loc = `<loc>${escapeXml(e.url)}</loc>`;
      const lastmod = e.lastModified
        ? `<lastmod>${escapeXml(typeof e.lastModified === 'string' ? e.lastModified : e.lastModified.toISOString())}</lastmod>`
        : '';
      const changefreq = e.changeFrequency
        ? `<changefreq>${e.changeFrequency}</changefreq>`
        : '';
      const priority = e.priority !== undefined
        ? `<priority>${e.priority.toFixed(1)}</priority>`
        : '';
      return `  <url>\n    ${[loc, lastmod, changefreq, priority].filter(Boolean).join('\n    ')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}
