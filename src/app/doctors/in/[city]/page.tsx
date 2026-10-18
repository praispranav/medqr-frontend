import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DoctorDirectoryPage } from '@/components/directory/DoctorDirectoryPage';
import { cityFromSlug, directoryPath } from '@/lib/directoryServer';

type SearchParams = { q?: string; specialty?: string; online?: string };

// Decision 66 — SEO landing page: "doctors in Patna". Supports ?q= search from URL.
export async function generateMetadata({ params, searchParams }: { params: { city: string }; searchParams?: SearchParams }): Promise<Metadata> {
  const city = await cityFromSlug(params.city);
  if (!city) return { title: 'Not found | ClinicQ', robots: { index: false } };
  const qSuffix = searchParams?.q ? ` matching "${searchParams.q}"` : '';
  const title = `Doctors in ${city}${qSuffix} — Clinics, Timings & Online OPD Booking | ClinicQ`;
  const description = `Find doctors and specialists in ${city}${qSuffix}: clinic address, OPD timings, directions and phone. Book an online OPD token at clinics that offer it — no app needed.`;
  return {
    title,
    description,
    alternates: { canonical: directoryPath(city) },
    openGraph: { title, description },
    ...(searchParams?.q ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function DoctorsInCityPage({ params, searchParams }: { params: { city: string }; searchParams?: SearchParams }) {
  const city = await cityFromSlug(params.city);
  if (!city) notFound();
  return <DoctorDirectoryPage city={city} q={searchParams?.q} bookable={searchParams?.online === '1'} landing={!searchParams?.q} />;
}

