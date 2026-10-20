import { PublicFooter } from '@/components/public/PublicFooter';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { searchDoctors, searchClinicsServer, directoryCities } from '@/lib/directoryServer';
import { groupBySlug } from '@/lib/specialtyGroups';
import { SearchClientView } from './SearchClientView';

interface SearchParams {
  q?: string;
  type?: 'all' | 'doctors' | 'clinics';
  city?: string;
  online?: string;
  area?: string;
  today?: string;
  specialty?: string;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const q = searchParams.q?.trim() || '';
  const city = searchParams.city?.trim() || '';
  const title = q
    ? `Search results for "${q}"${city ? ` in ${city}` : ''} | ClinicQ`
    : `Search Doctors, Clinics & Hospitals | ClinicQ`;
  const description = q
    ? `Find doctors and clinics matching "${q}"${city ? ` in ${city}` : ''}. OPD timings, address, phone and online token booking.`
    : 'Search verified doctors, clinics and hospitals across cities with OPD timings and online token booking.';

  return {
    title,
    description,
    alternates: { canonical: `/search${q ? `?q=${encodeURIComponent(q)}` : ''}` },
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const q = searchParams.q?.trim() || '';
  const city = searchParams.city?.trim() || undefined;
  const type = searchParams.type || 'all';
  const area = searchParams.area?.trim() || undefined;
  const today = searchParams.today === '1';
  const group = groupBySlug(searchParams.specialty);
  const specialtySlug = group?.slug || searchParams.specialty?.trim() || undefined;
  const bookable = searchParams.online === '1';

  const [doctors, clinics, cities] = await Promise.all([
    searchDoctors({ q: q || undefined, city, area, today, group: specialtySlug, bookable, limit: 24 }),
    searchClinicsServer({ q: q || undefined, group: specialtySlug, city, area, today, bookable, limit: 24 }),
    directoryCities(),
  ]);

  const matchedGroup = q ? groupBySlug(q.toLowerCase().replace(/[^a-z0-9]+/g, '-')) : null;

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-surface-container">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <BrandLogo />
          <nav className="hidden md:flex items-center gap-6 ml-6 font-label-md text-label-md text-on-surface-variant">
            <Link href="/doctors" className="hover:text-on-surface">Doctors</Link>
            <Link href="/clinics" className="hover:text-on-surface">Clinics</Link>
            <Link href="/for-clinics" className="hover:text-on-surface">For clinics</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/signin" className="h-10 px-5 inline-flex items-center rounded-xl bg-primary text-on-primary font-label-md text-label-md">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
        <SearchClientView
          initialQ={q}
          initialType={type}
          initialCity={city ?? ''}
          initialBookable={bookable}
          initialArea={area}
          initialToday={today}
          initialGroup={specialtySlug ?? ''}
          initialDoctors={doctors}
          initialClinics={clinics}
          cities={cities}
          matchedGroup={matchedGroup}
        />
      </div>
      <PublicFooter />
    </main>
  );
}
