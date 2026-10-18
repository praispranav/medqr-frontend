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

export async function generateMetadata({ params }: { params: { specialty: string } }): Promise<Metadata> {
  const r = await resolve(params.specialty);
  if (!r) return { title: 'Not found | ClinicQ', robots: { index: false } };
  const title = `${r.group.plural} Near You — Clinic Timings & Online OPD Booking | ClinicQ`;
  const description = `Find a ${r.group.name.toLowerCase()} near you: ${r.count} listed with clinic address, OPD timings and directions. Take an online OPD token where available.`;
  return { title, description, alternates: { canonical: directoryPath(null, r.group.slug) }, openGraph: { title, description } };
}

export default async function SpecialtyPage({ params }: { params: { specialty: string } }) {
  const r = await resolve(params.specialty);
  if (!r) notFound();
  return <DoctorDirectoryPage group={r.group} landing />;
}
