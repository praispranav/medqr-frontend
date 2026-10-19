import type { Metadata } from 'next';
import { DoctorDirectoryPage } from '@/components/directory/DoctorDirectoryPage';
import { directoryPath } from '@/lib/directoryServer';
import { groupBySlug } from '@/lib/specialtyGroups';

// Decision 66 — the doctor directory search. Filters are in the address (?q=&specialty=&city=&online=1);
// a city / specialty filter points search engines at its clean landing page (/doctors/in/patna/dentist).
type Params = { q?: string; specialty?: string; city?: string; online?: string; area?: string; today?: string };

export async function generateMetadata({ searchParams }: { searchParams: Params }): Promise<Metadata> {
  const group = groupBySlug(searchParams.specialty);
  const city = searchParams.city?.trim() || null;
  const what = group ? group.plural : 'Doctors';
  const title = city || group ? `${what}${city ? ` in ${city}` : ' Near You'} — Timings & Online OPD Booking | ClinicQ` : 'Find a Doctor Near You — Doctor & Clinic Directory | ClinicQ';
  return {
    title,
    description: `Search ${what.toLowerCase()}${city ? ` in ${city}` : ''} by name, specialty or city. See clinic address, OPD timings and directions, and book an online OPD token where available.`,
    alternates: { canonical: directoryPath(city, group?.slug) },
    // Free-text searches are for people, not for the index.
    ...(searchParams.q ? { robots: { index: false, follow: true } } : {}),
  };
}

export default function DoctorsIndexPage({ searchParams }: { searchParams: Params }) {
  const group = groupBySlug(searchParams.specialty);
  // Old links used ?q=<specialty name> — treat a q that is exactly a specialty as that specialty.
  const qGroup = !group && searchParams.q ? groupBySlug(searchParams.q.toLowerCase().replace(/[^a-z0-9]+/g, '-')) : null;
  return (
    <DoctorDirectoryPage
      q={qGroup ? undefined : searchParams.q}
      group={group ?? qGroup}
      city={searchParams.city?.trim() || null}
      bookable={searchParams.online === '1'}
      area={searchParams.area}
      today={searchParams.today === '1'}
      landing={false}
    />
  );
}
