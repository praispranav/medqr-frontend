import type { MetadataRoute } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/doctors`, changeFrequency: 'daily', priority: 0.9 },
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
