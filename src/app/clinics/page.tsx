import type { Metadata } from 'next';
import Link from 'next/link';
import { ClinicsSearch } from './ClinicsSearch';
import { BrandLogo } from '@/components/brand/BrandLogo';

// Decision 51 — clinics directory/search, the clinic equivalent of /doctors: previously a clinic page
// (clinicq.fit/clinics/:slug) was only reachable if you already knew its slug (from a doctor's page or
// a printed QR). This index makes clinics themselves searchable and discoverable.

export async function generateMetadata({ searchParams }: { searchParams: { q?: string; city?: string } }): Promise<Metadata> {
  const citySuffix = searchParams.city ? ` in ${searchParams.city}` : '';
  const q = searchParams.q ? ` matching "${searchParams.q}"` : '';
  return {
    title: `Find a Clinic${citySuffix} — Digital OPD Queue | ClinicQ`,
    description: `Search clinics${citySuffix}${q} offering ClinicQ's digital OPD token queue — no app download, live wait-time tracking.`,
    alternates: { canonical: '/clinics' },
  };
}

export default function ClinicsIndexPage({ searchParams }: { searchParams: { q?: string; city?: string } }) {
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Find a Clinic | ClinicQ',
    description: 'Directory of clinics offering digital OPD tokens and live queue tracking.',
  };

  return (
    <main className="min-h-screen bg-surface">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      <header className="border-b border-surface-container">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <BrandLogo />
          <Link href="/doctors" className="ml-auto font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
            Find a doctor →
          </Link>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg">
            {searchParams.city ? `Clinics in ${searchParams.city}` : 'Find a clinic'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Search by clinic name or city, then join the digital queue instantly.</p>
        </div>
        <ClinicsSearch initialQ={searchParams.q} />
      </div>
    </main>
  );
}
