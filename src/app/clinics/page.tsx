import type { Metadata } from 'next';
import Link from 'next/link';
import { ClinicsSearch } from './ClinicsSearch';
import { BrandLogo } from '@/components/brand/BrandLogo';

// Decision 51 — clinics directory/search, the clinic equivalent of /doctors: previously a clinic page
// (clinicq.fit/clinics/:slug) was only reachable if you already knew its slug (from a doctor's page or
// a printed QR). This index makes clinics themselves searchable and discoverable.

export async function generateMetadata({ searchParams }: { searchParams: { q?: string; city?: string; area?: string; bookable?: string; today?: string } }): Promise<Metadata> {
  const citySuffix = searchParams.city ? ` in ${searchParams.city}` : '';
  const q = searchParams.q ? ` matching "${searchParams.q}"` : '';
  return {
    title: `Clinics & Hospitals${citySuffix || ' Near You'} — Doctors, Timings & Directions | ClinicQ`,
    description: `Search clinics and hospitals${citySuffix}${q}: their doctors, address, OPD timings and directions. Book an online OPD token where the clinic offers it.`,
    alternates: { canonical: searchParams.city ? `/clinics/in/${searchParams.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '/clinics' },
    ...(searchParams.q || searchParams.area ? { robots: { index: false, follow: true } } : {}),
  };
}

export default function ClinicsIndexPage({ searchParams }: { searchParams: { q?: string; city?: string; area?: string; bookable?: string; today?: string } }) {
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Find a Clinic | ClinicQ',
    description: 'Directory of clinics and their doctors.',
  };

  return (
    <main className="min-h-screen bg-surface">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      <header className="border-b border-surface-container">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <BrandLogo />
          <Link href="/doctors" className="ml-auto font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
            Find a doctor →
          </Link>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10 flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg">
            Clinics &amp; hospitals near you
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Find clinics and hospitals with their doctors, address and directions. Clinics with online OPD booking are shown first.</p>
        </div>
        <ClinicsSearch initialQ={searchParams.q} initialCity={searchParams.city} initialArea={searchParams.area} initialBookable={searchParams.bookable === '1'} initialToday={searchParams.today === '1'} />
      </div>
    </main>
  );
}
