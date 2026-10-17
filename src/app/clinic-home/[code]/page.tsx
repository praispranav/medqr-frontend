import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { DirectoryClinicProfile } from '@/lib/api';
import { ClinicLanding } from '@/components/landing/ClinicLanding';
import { mainUrl } from '@/lib/clinicHost';

// Decision 56 — the home page of a clinic's own address (drkumar.clinicq.fit/ is rewritten here by the
// middleware). The same landing page as /clinics/<slug> (Decision 50), plus a staff Login button that
// appears ONLY here, so doctors and reception can log in without typing the clinic code. A clinic that
// isn't in the public directory still gets this page (name, address, its doctors), just not indexed.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type HomeProfile = DirectoryClinicProfile & { listed: boolean; public_slug: string | null };

async function getClinic(code: string): Promise<HomeProfile | null> {
  const res = await fetch(`${API_BASE}/directory/clinic-home/${encodeURIComponent(code)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const clinic = await getClinic(params.code);
  if (!clinic) return { title: 'Clinic not found — ClinicQ', robots: { index: false } };
  const title = `${[clinic.clinic_name, clinic.city].filter(Boolean).join(', ')} | ClinicQ`;
  return {
    title,
    description: clinic.tagline || `Join the digital queue at ${clinic.clinic_name}, no app download.`,
    // Listed clinics: the main-site page is the one search engines should show. Unlisted: never indexed.
    ...(clinic.listed && clinic.public_slug
      ? { alternates: { canonical: mainUrl(`/clinics/${clinic.public_slug}`, null) /* always the primary domain: one canonical copy */ } }
      : { robots: { index: false, follow: false } }),
  };
}

export default async function ClinicHomePage({ params }: { params: { code: string } }) {
  const clinic = await getClinic(params.code);
  if (!clinic) notFound();
  return <ClinicLanding clinic={clinic} staffLoginHref="/login" host={headers().get('host')} />;
}
