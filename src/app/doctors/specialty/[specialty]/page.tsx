import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DoctorDirectoryPage } from '@/components/directory/DoctorDirectoryPage';
import { directoryPath, specialtyGroupsIn } from '@/lib/directoryServer';
import { groupBySlug } from '@/lib/specialtyGroups';

// Decision 66 — SEO landing page for one specialty across all cities ("pediatrician near me").
async function resolve(slug: string) {
  const group = groupBySlug(slug);
  if (!group) return null;
  const count = (await specialtyGroupsIn()).find((g) => g.slug === group.slug)?.count ?? 0;
  return count ? { group, count } : null;
}

type SearchParams = { q?: string; city?: string; online?: string };

export async function generateMetadata({ params, searchParams }: { params: { specialty: string }; searchParams?: SearchParams }): Promise<Metadata> {
  const r = await resolve(params.specialty);
  if (!r) return { title: 'Not found | ClinicQ', robots: { index: false } };
  const qSuffix = searchParams?.q ? ` matching "${searchParams.q}"` : '';
  const citySuffix = searchParams?.city ? ` in ${searchParams.city}` : '';
  const title = `${r.group.plural}${citySuffix || ' Near You'}${qSuffix} — Clinic Timings & Online OPD Booking | ClinicQ`;
  const description = `Find a ${r.group.name.toLowerCase()}${citySuffix || ' near you'}${qSuffix}: ${r.count} listed with clinic address, OPD timings and directions. Take an online OPD token where available.`;
  return {
    title,
    description,
    alternates: { canonical: directoryPath(searchParams?.city ?? null, r.group.slug) },
    openGraph: { title, description },
    ...(searchParams?.q ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SpecialtyPage({ params, searchParams }: { params: { specialty: string }; searchParams?: SearchParams }) {
  const r = await resolve(params.specialty);
  if (!r) notFound();
  return <DoctorDirectoryPage group={r.group} city={searchParams?.city} q={searchParams?.q} bookable={searchParams?.online === '1'} landing={!searchParams?.q} />;
}

