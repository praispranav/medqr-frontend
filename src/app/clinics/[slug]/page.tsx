import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { DirectoryClinicProfile } from '@/lib/api';
import { ClinicLanding } from '@/components/landing/ClinicLanding';

// Public, server-rendered clinic page — for polyclinics/multi-doctor setups, listing every doctor
// there who has opted into the directory. Same server-component approach as /doctors/[slug], for SEO.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function getClinic(slug: string): Promise<DirectoryClinicProfile | null> {
  const res = await fetch(`${API_BASE}/directory/clinics/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const clinic = await getClinic(params.slug);
  if (!clinic) return { title: 'Clinic not found — ClinicQ' };
  const place = [clinic.clinic_name, clinic.city].filter(Boolean).join(', ');
  const title = `${place} — Doctors, Timings & Address | ClinicQ`;
  // Decision 66: say plainly whether online OPD booking is available here.
  const booking = clinic.booking_open ? 'Online OPD booking available — take your token from your phone.' : 'Address, timings and directions.';
  const description = clinic.tagline || clinic.about?.slice(0, 160) || `${clinic.doctors.length} doctor${clinic.doctors.length === 1 ? '' : 's'} at ${clinic.clinic_name}${clinic.city ? ` in ${clinic.city}` : ''}. ${booking}`;
  return {
    title,
    description,
    alternates: { canonical: `/clinics/${params.slug}` },
    // Decision 66: a clinic with no listed doctor isn't searchable — the page still opens by link.
    ...(clinic.doctors.length === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, type: 'website' },
  };
}

export default async function ClinicProfilePage({ params, searchParams }: { params: { slug: string }; searchParams: { preview?: string } }) {
  const clinic = await getClinic(params.slug);
  if (!clinic) notFound();
  // ?preview=playful|editorial shows the other look before choosing it in Public Profile.
  const preview = searchParams.preview === 'playful' || searchParams.preview === 'editorial' ? searchParams.preview : null;
  return <ClinicLanding clinic={preview ? { ...clinic, landing_template: preview } : clinic} host={headers().get('host')} />;
}
