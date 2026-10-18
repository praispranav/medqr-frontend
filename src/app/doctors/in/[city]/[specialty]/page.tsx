import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DoctorDirectoryPage } from '@/components/directory/DoctorDirectoryPage';
import { cityFromSlug, directoryPath, specialtyGroupsIn } from '@/lib/directoryServer';
import { groupBySlug } from '@/lib/specialtyGroups';

// Decision 66 — SEO landing page: "dentist in Patna", "ENT specialist in Sitamarhi". Only exists when that
// city really has such a doctor listed (no empty pages).
async function resolve(params: { city: string; specialty: string }) {
  const [city, group] = [await cityFromSlug(params.city), groupBySlug(params.specialty)];
  if (!city || !group) return null;
  const count = (await specialtyGroupsIn(city)).find((g) => g.slug === group.slug)?.count ?? 0;
  return count ? { city, group, count } : null;
}

type SearchParams = { q?: string; online?: string };

export async function generateMetadata({ params, searchParams }: { params: { city: string; specialty: string }; searchParams?: SearchParams }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return { title: 'Not found | ClinicQ', robots: { index: false } };
  const qSuffix = searchParams?.q ? ` matching "${searchParams.q}"` : '';
  const title = `${r.group.plural} in ${r.city}${qSuffix} — Timings, Address & Online OPD Booking | ClinicQ`;
  const description = `${r.count} ${r.count === 1 ? r.group.name.toLowerCase() : r.group.plural.toLowerCase()} in ${r.city}${qSuffix} with clinic address, OPD timings, directions and phone. Take an online OPD token where available.`;
  return {
    title,
    description,
    alternates: { canonical: directoryPath(r.city, r.group.slug) },
    openGraph: { title, description },
    ...(searchParams?.q ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SpecialtyInCityPage({ params, searchParams }: { params: { city: string; specialty: string }; searchParams?: SearchParams }) {
  const r = await resolve(params);
  if (!r) notFound();
  return <DoctorDirectoryPage city={r.city} group={r.group} q={searchParams?.q} bookable={searchParams?.online === '1'} landing={!searchParams?.q} />;
}

