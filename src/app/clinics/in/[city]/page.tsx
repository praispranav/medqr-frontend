import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ClinicsSearch } from '@/app/clinics/ClinicsSearch';
import { cityFromSlug, directoryPath } from '@/lib/directoryServer';

// Decision 66 — SEO landing page: "clinics in Patna", "hospitals in Sitamarhi".
export async function generateMetadata({ params }: { params: { city: string } }): Promise<Metadata> {
  const city = await cityFromSlug(params.city);
  if (!city) return { title: 'Not found | ClinicQ', robots: { index: false } };
  const title = `Clinics & Hospitals in ${city} — Doctors, Timings & Directions | ClinicQ`;
  const description = `Clinics and hospitals in ${city} with their doctors, address, OPD timings, phone and directions. Book an online OPD token at clinics that offer it.`;
  return { title, description, alternates: { canonical: `/clinics/in/${params.city.toLowerCase()}` }, openGraph: { title, description } };
}

export default async function ClinicsInCityPage({ params }: { params: { city: string } }) {
  const city = await cityFromSlug(params.city);
  if (!city) notFound();
  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-surface-container">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <BrandLogo />
          <Link href={directoryPath(city)} className="ml-auto font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
            Doctors in {city} →
          </Link>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10 flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg">Clinics &amp; hospitals in {city}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-3xl">
            Clinics and hospitals in {city} with their doctors, address and directions. Those offering online OPD booking are shown first.
          </p>
        </div>
        <ClinicsSearch initialCity={city} />
      </div>
    </main>
  );
}
