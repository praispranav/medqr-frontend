import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DoctorDirectoryPage } from '@/components/directory/DoctorDirectoryPage';
import { cityFromSlug, directoryPath } from '@/lib/directoryServer';

// Decision 66 — SEO landing page: "doctors in Patna".
export async function generateMetadata({ params }: { params: { city: string } }): Promise<Metadata> {
  const city = await cityFromSlug(params.city);
  if (!city) return { title: 'Not found | ClinicQ', robots: { index: false } };
  const title = `Doctors in ${city} — Clinics, Timings & Online OPD Booking | ClinicQ`;
  const description = `Find doctors and specialists in ${city}: clinic address, OPD timings, directions and phone. Book an online OPD token at clinics that offer it — no app needed.`;
  return { title, description, alternates: { canonical: directoryPath(city) }, openGraph: { title, description } };
}

export default async function DoctorsInCityPage({ params }: { params: { city: string } }) {
  const city = await cityFromSlug(params.city);
  if (!city) notFound();
  return <DoctorDirectoryPage city={city} landing />;
}
