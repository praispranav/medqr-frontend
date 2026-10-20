import { PublicFooter } from '@/components/public/PublicFooter';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { DoctorsSearch, DOCTORS_PAGE_SIZE } from '@/app/doctors/DoctorsSearch';
import { directoryCities, directoryPath, searchDoctors, specialtyGroupsIn } from '@/lib/directoryServer';
import type { SpecialtyGroup } from '@/lib/specialtyGroups';

/**
 * Decision 66 — one server-rendered page for the doctor directory and every SEO landing page:
 * /doctors, /doctors/in/<city>, /doctors/specialty/<specialty>, /doctors/in/<city>/<specialty>.
 * The first page of doctors, the heading and the related links are in the HTML; more load as you scroll.
 * Only facts from the directory — no rankings, no "best".
 */
export async function DoctorDirectoryPage({ city, group, q, bookable = false, area, today = false, landing }: { city?: string | null; group?: SpecialtyGroup | null; q?: string; bookable?: boolean; area?: string; today?: boolean; landing: boolean }) {
  const [results, groupsHere, cities] = await Promise.all([
    searchDoctors({ q, group: group?.slug, city: city ?? undefined, area, today, bookable, limit: DOCTORS_PAGE_SIZE }),
    specialtyGroupsIn(city),
    directoryCities(),
  ]);
  // Only link to city pages that actually have this specialty (no empty pages).
  const cityLinks = group
    ? (await Promise.all(cities.map(async (c) => ((await specialtyGroupsIn(c)).some((g) => g.slug === group.slug) ? c : null)))).filter((c): c is string => !!c)
    : cities;
  const total = group ? groupsHere.find((g) => g.slug === group.slug)?.count : undefined;
  const who = group ? group.plural : 'Doctors';
  const heading = city ? `${who} in ${city}` : group ? `${group.plural} near you` : 'Find a doctor';
  const online = results.filter((d) => d.booking_open).length;

  const crumbs = [
    { name: 'ClinicQ', path: '/' },
    { name: 'Doctors', path: '/doctors' },
    ...(city ? [{ name: city, path: directoryPath(city) }] : []),
    ...(group ? [{ name: group.plural, path: directoryPath(city, group.slug) }] : []),
  ];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://clinicq.fit';
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${site}${c.path}` })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: heading,
      itemListElement: results.slice(0, 20).map((d, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Physician',
          name: d.name,
          url: `${site}/doctors/${d.slug}`,
          medicalSpecialty: d.specialty ?? undefined,
          address: d.city ? { '@type': 'PostalAddress', addressLocality: d.city, addressCountry: 'IN' } : undefined,
        },
      })),
    },
  ];

  return (
    <main className="min-h-screen bg-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="border-b border-surface-container">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <BrandLogo />
          <nav className="ml-auto flex items-center gap-5 font-label-md text-label-md text-on-surface-variant">
            <Link href="/clinics" className="hover:text-on-surface">Clinics &amp; hospitals</Link>
            <Link href="/for-clinics" className="hidden sm:inline hover:text-on-surface">For doctors</Link>
          </nav>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 flex flex-col gap-6">
        {crumbs.length > 2 && (
          <nav aria-label="Breadcrumb" className="font-body-sm text-body-sm text-on-surface-variant flex flex-wrap gap-1.5">
            {crumbs.slice(1).map((c, i, all) => (
              <span key={c.path} className="flex gap-1.5">
                {i < all.length - 1 ? <Link href={c.path} className="hover:text-primary">{c.name}</Link> : <span className="text-on-surface">{c.name}</span>}
                {i < all.length - 1 && <span aria-hidden>›</span>}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-col gap-2">
          <h1 className="font-headline-lg text-headline-lg">{heading}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            {landing
              ? `${total ? `${total} ${total === 1 ? group?.name.toLowerCase() ?? 'doctor' : who.toLowerCase()}` : who} listed${city ? ` in ${city}` : ''} on ClinicQ, with clinic address, timings and directions.${online ? ' Doctors marked “Online OPD booking” let you take your token from your phone and wait from home.' : ' Where a clinic offers online OPD booking, you can take your token from your phone.'}`
              : 'Search doctors by name, specialty or city and see their clinic, timings and directions. Doctors with online OPD booking let you take your token from your phone.'}
          </p>
        </div>

        <DoctorsSearch initialQ={q} initialGroup={group?.slug} initialCity={city ?? ''} initialBookable={bookable} initialArea={area} initialToday={today} initialResults={results} syncUrl={true} />

        {/* Internal links: the specialties in this city, and this specialty in other cities. */}
        <section className="border-t border-surface-container pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {groupsHere.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-label-lg text-label-lg">{city ? `Specialists in ${city}` : 'Browse by specialty'}</h2>
              <div className="flex flex-wrap gap-2">
                {groupsHere.filter((g) => g.slug !== group?.slug).map((g) => (
                  <Link key={g.slug} href={directoryPath(city, g.slug)} className="px-3 py-1.5 rounded-full bg-surface-container-lowest shadow-sm font-label-md text-label-md text-on-surface-variant hover:text-primary">
                    {city ? `${g.plural} in ${city}` : g.plural}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {cityLinks.filter((c) => c !== city).length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-label-lg text-label-lg">{group ? `${group.plural} in other cities` : 'Browse by city'}</h2>
              <div className="flex flex-wrap gap-2">
                {cityLinks.filter((c) => c !== city).map((c) => (
                  <Link key={c} href={directoryPath(c, group?.slug)} className="px-3 py-1.5 rounded-full bg-surface-container-lowest shadow-sm font-label-md text-label-md text-on-surface-variant hover:text-primary">
                    {group ? `${group.plural} in ${c}` : `Doctors in ${c}`}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      <PublicFooter />
    </main>
  );
}
