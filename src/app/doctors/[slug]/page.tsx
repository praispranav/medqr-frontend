import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { DirectoryDoctorProfile } from '@/lib/api';

// Public, server-rendered doctor profile — the actual target of medqr.in/doctors search results and
// of Google search. Deliberately a server component (not 'use client' like the rest of the app) so
// the title/description/structured data are in the HTML a crawler sees, not injected after the fact.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function getDoctor(slug: string): Promise<DirectoryDoctorProfile | null> {
  const res = await fetch(`${API_BASE}/directory/doctors/${encodeURIComponent(slug)}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const doctor = await getDoctor(params.slug);
  if (!doctor) return { title: 'Doctor not found — MedQR' };
  const place = [doctor.clinic_name, doctor.city].filter(Boolean).join(', ');
  const title = `${doctor.name}${doctor.specialty ? ` — ${doctor.specialty}` : ''}${place ? ` in ${place}` : ''} | MedQR`;
  const description = doctor.bio || `Book a digital queue token with ${doctor.name}${place ? ` at ${place}` : ''}. No app download, no waiting in line.`;
  return { title, description };
}

export default async function DoctorProfilePage({ params }: { params: { slug: string } }) {
  const doctor = await getDoctor(params.slug);
  if (!doctor) notFound();

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="border-b border-surface-container">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
          <span className="font-headline-sm text-headline-sm text-primary">MedQR</span>
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
              <img src={doctor.photo_url} alt={doctor.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
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
              <p className="font-body-md text-body-md text-on-surface-variant">{[doctor.qualification, doctor.specialty].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          {doctor.bio && <p className="font-body-md text-body-md text-on-surface-variant">{doctor.bio}</p>}
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col gap-2">
          <h2 className="font-headline-sm text-headline-sm">{doctor.clinic_name}</h2>
          {(doctor.address || doctor.city) && <p className="font-body-md text-body-md text-on-surface-variant">{[doctor.address, doctor.city].filter(Boolean).join(', ')}</p>}
          {doctor.public_phone && <p className="font-body-md text-body-md text-on-surface-variant">{doctor.public_phone}</p>}
        </div>

        <Link
          href={`/patient/${doctor.clinic_subdomain}/intake?doctorId=${doctor.id}`}
          className="h-14 px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2"
        >
          Get a digital queue token
        </Link>
        <p className="text-center font-body-sm text-body-sm text-on-surface-variant">No app download — instant QR check-in via MedQR.</p>
      </div>
    </main>
  );
}
