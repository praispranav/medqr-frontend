import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { fileUrl, type DirectoryClinicProfile, type DirectoryDoctorProfile } from '@/lib/api';
import { ClinicLanding } from '@/components/landing/ClinicLanding';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { patientUrl } from '@/lib/clinicHost';
import { groupBySlug, groupOf } from '@/lib/specialtyGroups';
import { cityFromSlug } from '@/lib/directoryServer';
import { VerifiedBadge } from '@/components/directory/VerifiedBadge';

// Public, server-rendered doctor profile — the actual target of clinicq.fit/doctors search results and
// of Google search. Deliberately a server component (not 'use client' like the rest of the app) so
// the title/description/structured data are in the HTML a crawler sees, not injected after the fact.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function getDoctor(slug: string): Promise<DirectoryDoctorProfile | null> {
  const res = await fetch(`${API_BASE}/directory/doctors/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function getClinic(slug: string): Promise<DirectoryClinicProfile | null> {
  const res = await fetch(`${API_BASE}/directory/clinics/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  return res.ok ? res.json() : null;
}

export async function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams?: { q?: string } }): Promise<Metadata> {
  if (params.slug === 'search') return { title: 'Search Doctors | ClinicQ', robots: { index: false } };
  const doctor = await getDoctor(params.slug);
  if (!doctor) {
    const city = await cityFromSlug(params.slug);
    if (city) return { title: `Doctors in ${city} | ClinicQ` };
    const group = groupBySlug(params.slug);
    if (group) return { title: `${group.plural} Near You | ClinicQ` };
    return { title: 'Find a Doctor — ClinicQ' };
  }
  const place = [doctor.clinic_name, doctor.city].filter(Boolean).join(', ');
  const specialty = groupOf(doctor.specialty)?.name ?? doctor.specialty;
  const title = `${doctor.name}${specialty ? `, ${specialty}` : ''}${doctor.city ? ` in ${doctor.city}` : ''} — Timings, Address & Fees | ClinicQ`;
  // Decision 66: whether online OPD booking is available is part of the description.
  const description = `${doctor.name}${specialty ? `, ${specialty.toLowerCase()}` : ''}${place ? ` at ${place}` : ''}. ${doctor.booking_open ? 'Online OPD booking available — take your token from your phone, no app needed.' : 'Clinic address, OPD timings, phone and directions.'}${doctor.bio ? ` ${doctor.bio.slice(0, 80)}` : ''}`;
  return {
    title,
    description,
    alternates: { canonical: `/doctors/${params.slug}` },
    openGraph: { title, description, type: 'profile', images: doctor.photo_url ? [fileUrl(doctor.photo_url)] : undefined },
  };
}

export default async function DoctorProfilePage({ params, searchParams }: { params: { slug: string }; searchParams?: { q?: string } }) {
  if (params.slug === 'search') {
    redirect(`/doctors${searchParams?.q ? `?q=${encodeURIComponent(searchParams.q)}` : ''}`);
  }
  const city = await cityFromSlug(params.slug);
  if (city) {
    redirect(`/doctors/in/${params.slug}`);
  }
  const group = groupBySlug(params.slug);
  if (group) {
    redirect(`/doctors/specialty/${params.slug}`);
  }

  const doctor = await getDoctor(params.slug);
  if (!doctor) {
    // URL search fallback: if the slug is not a known doctor, search by term
    redirect(`/doctors?q=${encodeURIComponent(params.slug.replace(/[-_]+/g, ' '))}`);
  }

  // Decision 50: when the doctor's clinic is listed, the doctor's page is the clinic's landing page with this doctor first.
  const clinic = doctor.clinic_public_slug ? await getClinic(doctor.clinic_public_slug) : null;
  if (clinic) return <ClinicLanding clinic={clinic} focusSlug={doctor.slug} host={headers().get('host')} />;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: doctor.name,
    medicalSpecialty: doctor.specialty ?? undefined,
    description: doctor.bio ?? undefined,
    worksFor: doctor.clinic_name ? { '@type': 'MedicalClinic', name: doctor.clinic_name, address: doctor.address ?? undefined } : undefined,
  };

  return (
    <main className="min-h-screen bg-surface">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="border-b border-surface-container">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
          <BrandLogo />
          <Link href="/doctors" className="ml-auto font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
            ← All doctors
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col gap-3">
          <div className="flex items-start gap-4">
            {doctor.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(doctor.photo_url)} alt={doctor.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center shrink-0 font-headline-sm text-headline-sm">
                {doctor.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')}
              </div>
            )}
            <div>
              <h1 className="font-headline-lg text-headline-lg">{doctor.name}</h1>
              {doctor.verified && <VerifiedBadge size="md" />}
              <p className="font-body-md text-body-md text-on-surface-variant">{[doctor.qualification, doctor.specialty].filter(Boolean).join(' · ')}</p>
              {!!doctor.experience_years && <p className="font-body-sm text-body-sm text-on-surface-variant">{doctor.experience_years}+ {doctor.experience_years === 1 ? 'year' : 'years'} experience</p>}
            </div>
          </div>
          {doctor.bio && <p className="font-body-md text-body-md text-on-surface-variant">{doctor.bio}</p>}
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col gap-2">
          <h2 className="font-headline-sm text-headline-sm">{doctor.clinic_name}</h2>
          {(doctor.address || doctor.city) && <p className="font-body-md text-body-md text-on-surface-variant">{[doctor.address, doctor.city].filter(Boolean).join(', ')}</p>}
          {doctor.public_phone && <p className="font-body-md text-body-md text-on-surface-variant">{doctor.public_phone}</p>}
        </div>

        {/* Decision 60: only clinics that opted in take online tokens. */}
        {doctor.booking_open !== false && (
          <>
            <Link
              href={patientUrl(`/patient/${doctor.clinic_subdomain}/intake?doctorId=${doctor.id}`, headers().get('host'))}
              className="h-14 px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2"
            >
              Get a digital queue token
            </Link>
            <p className="text-center font-body-sm text-body-sm text-on-surface-variant">No app download — instant QR check-in via ClinicQ.</p>
          </>
        )}
      </div>
    </main>
  );
}
