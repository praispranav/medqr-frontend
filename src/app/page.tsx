import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { HomeSearch } from '@/components/home/HomeSearch';
import { Icon } from '@/components/patient/ui';
import { WhatsAppFloat } from '@/components/support/WhatsAppFloat';
import { COMPANY_NAME, COMPANY_URL } from '@/components/support/contactInfo';
import { patientUrl } from '@/lib/clinicHost';
import type { DirectoryClinicSummary } from '@/lib/api';
import { directoryCities, directoryPath, specialtyGroupsIn } from '@/lib/directoryServer';
import { placeSlug } from '@/lib/specialtyGroups';

// Decision 58 / 66 — ClinicQ is a doctor & clinic directory: patients find a doctor or clinic (timings,
// address, directions) and, where the clinic has it, book an online OPD token — that's the product clinics
// buy (pitched at /for-clinics). Only real data is shown, and "Popular searches" links to the server-rendered
// city / specialty pages so search engines can reach every listed doctor.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const metadata: Metadata = {
  title: 'ClinicQ | Find Doctors & Clinics Near You — Timings, Address & Online OPD Booking',
  description:
    'Find doctors, clinics and hospitals in Patna, Sitamarhi and nearby: OPD timings, address, phone and directions. Book an online OPD token at clinics that offer it — no app needed.',
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const host = headers().get('host');
  const [groups, clinics, cities] = await Promise.all([
    specialtyGroupsIn(),
    getJson<DirectoryClinicSummary[]>('/directory/clinics?bookable=1&limit=6', []), // Decision 60: only clinics taking online tokens
    directoryCities(),
  ]);
  const popular = await Promise.all(cities.map(async (city) => ({ city, groups: (await specialtyGroupsIn(city)).sort((a, b) => b.count - a.count).slice(0, 8) })));
  const patientHome = patientUrl('/patient', host);

  const card = 'bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex gap-4 items-start hover:shadow-md transition-shadow';

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-surface-container">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <BrandLogo />
          <nav className="hidden md:flex items-center gap-6 ml-6 font-label-md text-label-md text-on-surface-variant">
            <Link href="/doctors" className="hover:text-on-surface">Find a doctor</Link>
            <Link href="/clinics" className="hover:text-on-surface">Find a clinic</Link>
            <Link href="/for-clinics" className="hover:text-on-surface">For clinics</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href={patientHome} className="h-10 px-4 inline-flex items-center whitespace-nowrap rounded-xl bg-surface-container-low text-primary font-label-md text-label-md">
              <span className="sm:hidden">Patient</span>
              <span className="hidden sm:inline">Patient Login</span>
            </a>
            <Link href="/login" className="h-10 px-4 inline-flex items-center whitespace-nowrap rounded-xl bg-primary text-on-primary font-label-md text-label-md">
              <span className="sm:hidden">Staff</span>
              <span className="hidden sm:inline">Doctor/Staff Login</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Search */}
      <section className="max-w-6xl mx-auto px-4 pt-12 sm:pt-16 pb-10 flex flex-col items-center text-center gap-5">
        <span className="px-3 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm uppercase">
          Doctor &amp; clinic directory · Free to search
        </span>
        <h1 className="font-headline-lg text-[34px] leading-[40px] sm:text-[44px] sm:leading-[50px] tracking-tight font-extrabold max-w-3xl">
          Find the right doctor near you.
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
          Doctors, clinics and hospitals with OPD timings, address and directions. Where a clinic offers online OPD booking, take your token from your phone and wait from home.
        </p>
        <HomeSearch />
        {groups.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 max-w-3xl">
            {groups.slice(0, 10).map((g) => (
              <Link
                key={g.slug}
                href={directoryPath(null, g.slug)}
                className="h-9 px-3.5 inline-flex items-center rounded-full bg-surface-container-lowest shadow-sm font-label-md text-label-md text-on-surface-variant hover:text-primary"
              >
                {g.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* What you can do here */}
      <section className="max-w-6xl mx-auto px-4 pb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href={patientHome} className={card}>
          <span className="w-11 h-11 rounded-xl bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
            <Icon name="confirmation_number" className="text-[22px]" />
          </span>
          <span className="flex flex-col gap-1 text-left">
            <span className="font-label-lg text-label-lg">Your tokens &amp; past visits</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">Log in with a WhatsApp code to see today’s token and the doctors you’ve visited.</span>
          </span>
        </a>
        <div className={card}>
          <span className="w-11 h-11 rounded-xl bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
            <Icon name="qr_code_scanner" className="text-[22px]" />
          </span>
          <span className="flex flex-col gap-1 text-left">
            <span className="font-label-lg text-label-lg">At the clinic?</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">Scan the QR code at the counter to take your token — no forms at the desk.</span>
          </span>
        </div>
        <Link href="/login" className={card}>
          <span className="w-11 h-11 rounded-xl bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
            <Icon name="stethoscope" className="text-[22px]" />
          </span>
          <span className="flex flex-col gap-1 text-left">
            <span className="font-label-lg text-label-lg">Doctor or reception?</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">Log in to run today’s queue, call patients and see payments.</span>
          </span>
        </Link>
      </section>

      {/* Listed clinics that take online tokens (Decision 60) */}
      {clinics.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-14 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-headline-sm text-headline-sm">Clinics with online OPD booking</h2>
            <Link href="/clinics" className="font-label-md text-label-md text-primary whitespace-nowrap">See all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clinics.slice(0, 6).map((c) => (
              <Link key={c.slug} href={`/clinics/${c.slug}`} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
                <span className="w-10 h-10 rounded-xl bg-surface-container-low text-primary flex items-center justify-center shrink-0">
                  <Icon name="local_hospital" className="text-[20px]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-label-lg text-label-lg truncate">{c.clinic_name}</span>
                  <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
                    {[c.city, `${c.doctor_count} doctor${c.doctor_count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Icon name="chevron_right" className="text-on-surface-variant text-[20px]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Popular searches — real city / specialty pages, for patients and for search engines. */}
      {popular.some((p) => p.groups.length) && (
        <section className="max-w-6xl mx-auto px-4 pb-14 flex flex-col gap-5">
          <h2 className="font-headline-sm text-headline-sm">Popular searches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {popular.filter((p) => p.groups.length).map((p) => (
              <div key={p.city} className="flex flex-col gap-2">
                <h3 className="font-label-lg text-label-lg">
                  <Link href={directoryPath(p.city)} className="hover:text-primary">Doctors in {p.city}</Link>
                  <span className="text-on-surface-variant font-body-sm text-body-sm"> · </span>
                  <Link href={`/clinics/in/${placeSlug(p.city)}`} className="font-body-sm text-body-sm text-primary">Clinics &amp; hospitals</Link>
                </h3>
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 font-body-sm text-body-sm text-on-surface-variant">
                  {p.groups.map((g) => (
                    <li key={g.slug}>
                      <Link href={directoryPath(p.city, g.slug)} className="hover:text-primary">{g.plural} in {p.city}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* For clinics → the marketing page */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-3xl bg-primary text-on-primary p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="font-headline-sm text-headline-sm">Doctor or clinic owner?</h2>
            <p className="font-body-md text-body-md opacity-90">Your listing is free. Add online OPD booking — patients take a token from their phone, with QR check-in and WhatsApp alerts. No hardware.</p>
          </div>
          <Link href="/for-clinics" className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-lowest text-primary font-label-lg text-label-lg shrink-0">
            Online OPD booking <Icon name="arrow_forward" className="text-[20px]" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-surface-container">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col xl:flex-row gap-3 justify-between font-body-sm text-body-sm text-on-surface-variant">
          <p>
            © {new Date().getFullYear()} ClinicQ · Doctor &amp; clinic directory with online OPD booking · A product of{' '}
            <a href={COMPANY_URL} target="_blank" rel="noreferrer" className="text-primary font-label-md text-label-md">{COMPANY_NAME}</a>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/for-clinics">For clinics</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/contact">Contact &amp; help</Link>
            <a href={patientHome}>Patient Login</a>
            <Link href="/login">Doctor/Staff Login</Link>
          </div>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}
