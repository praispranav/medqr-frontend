import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { DirectoryClinicProfile } from '@/lib/api';
import { ClinicLanding } from '@/components/landing/ClinicLanding';

// Public, server-rendered clinic page — for polyclinics/multi-doctor setups, listing every doctor
// there who has opted into the directory. Same server-component approach as /doctors/[slug], for SEO.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function getClinic(slug: string): Promise<DirectoryClinicProfile | null> {
  const res = await fetch(`${API_BASE}/directory/clinics/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const clinic = await getClinic(params.slug);
  if (!clinic) return { title: 'Clinic not found — ClinicQ' };
  const place = [clinic.clinic_name, clinic.city].filter(Boolean).join(', ');
  const title = `${place} — Doctors & Queue | ClinicQ`;
  const description = clinic.tagline || clinic.about?.slice(0, 160) || `${clinic.doctors.length} doctor${clinic.doctors.length === 1 ? '' : 's'} at ${clinic.clinic_name}${clinic.city ? ` in ${clinic.city}` : ''}. Join the digital queue, no app download.`;
  return {
    title,
    description,
    alternates: { canonical: `/clinics/${params.slug}` },
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
