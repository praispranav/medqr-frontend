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

export async function generateMetadata({ params }: { params: { city: string; specialty: string } }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return { title: 'Not found | ClinicQ', robots: { index: false } };
  const title = `${r.group.plural} in ${r.city} — Timings, Address & Online OPD Booking | ClinicQ`;
  const description = `${r.count} ${r.count === 1 ? r.group.name.toLowerCase() : r.group.plural.toLowerCase()} in ${r.city} with clinic address, OPD timings, directions and phone. Take an online OPD token where available.`;
  return { title, description, alternates: { canonical: directoryPath(r.city, r.group.slug) }, openGraph: { title, description } };
}

export default async function SpecialtyInCityPage({ params }: { params: { city: string; specialty: string } }) {
  const r = await resolve(params);
  if (!r) notFound();
  return <DoctorDirectoryPage city={r.city} group={r.group} landing />;
}
