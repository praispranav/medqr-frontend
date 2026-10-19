import type { DirectoryDoctorSummary } from '@/lib/api';
import { placeSlug } from '@/lib/specialtyGroups';

// Server-side helpers for the public directory pages (Decision 66) — rendered on the server so search
// engines see the doctors in the HTML.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const directoryCities = () => getJson<string[]>('/directory/cities', []);

/** "patna" -> "Patna" (the stored city name), or null when no listed doctor/clinic is in that city. */
export async function cityFromSlug(slug: string): Promise<string | null> {
  return (await directoryCities()).find((c) => placeSlug(c) === slug.toLowerCase()) ?? null;
}

export type GroupCount = { slug: string; name: string; plural: string; count: number };
export const specialtyGroupsIn = (city?: string | null) =>
  getJson<GroupCount[]>(`/directory/specialty-groups${city ? `?city=${encodeURIComponent(city)}` : ''}`, []);

export function searchDoctors(opts: { q?: string; group?: string; city?: string; area?: string; today?: boolean; bookable?: boolean; limit: number }) {
  const p = new URLSearchParams({ limit: String(opts.limit) });
  if (opts.q) p.set('q', opts.q);
  if (opts.group) p.set('group', opts.group);
  if (opts.city) p.set('city', opts.city);
  if (opts.area) p.set('area', opts.area);
  if (opts.today) p.set('today', '1');
  if (opts.bookable) p.set('bookable', '1');
  return getJson<DirectoryDoctorSummary[]>(`/directory/doctors?${p}`, []);
}

export function searchClinicsServer(opts: { q?: string; city?: string; area?: string; today?: boolean; bookable?: boolean; limit: number }) {
  const p = new URLSearchParams({ limit: String(opts.limit) });
  if (opts.q) p.set('q', opts.q);
  if (opts.city) p.set('city', opts.city);
  if (opts.area) p.set('area', opts.area);
  if (opts.today) p.set('today', '1');
  if (opts.bookable) p.set('bookable', '1');
  return getJson<import('@/lib/api').DirectoryClinicSummary[]>(`/directory/clinics?${p}`, []);
}


/** Clean landing address for a filter combination — the canonical URL search engines should index. */
export function directoryPath(city?: string | null, group?: string | null): string {
  if (city && group) return `/doctors/in/${placeSlug(city)}/${group}`;
  if (city) return `/doctors/in/${placeSlug(city)}`;
  if (group) return `/doctors/specialty/${group}`;
  return '/doctors';
}
