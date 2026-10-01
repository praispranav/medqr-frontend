import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { DirectoryClinicProfile } from '@/lib/api';

// Public, server-rendered clinic page — for polyclinics/multi-doctor setups, listing every doctor
// there who has opted into the directory. Same server-component approach as /doctors/[slug], for SEO.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

async function getClinic(slug: string): Promise<DirectoryClinicProfile | null> {
  const res = await fetch(`${API_BASE}/directory/clinics/${encodeURIComponent(slug)}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const clinic = await getClinic(params.slug);
  if (!clinic) return { title: 'Clinic not found — MedQR' };
  const place = [clinic.clinic_name, clinic.city].filter(Boolean).join(', ');
  return {
    title: `${place} — Doctors & Queue | MedQR`,
    description: `${clinic.doctors.length} doctor${clinic.doctors.length === 1 ? '' : 's'} at ${clinic.clinic_name}${clinic.city ? ` in ${clinic.city}` : ''}. Join the digital queue, no app download.`,
  };
}

export default async function ClinicProfilePage({ params }: { params: { slug: string } }) {
  const clinic = await getClinic(params.slug);
  if (!clinic) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: clinic.clinic_name,
    address: clinic.address ?? undefined,
    telephone: clinic.public_phone ?? undefined,
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
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col gap-1">
          <h1 className="font-headline-lg text-headline-lg">{clinic.clinic_name}</h1>
          {(clinic.address || clinic.city) && <p className="font-body-md text-body-md text-on-surface-variant">{[clinic.address, clinic.city].filter(Boolean).join(', ')}</p>}
          {clinic.public_phone && <p className="font-body-md text-body-md text-on-surface-variant">{clinic.public_phone}</p>}
        </div>

        <div>
          <h2 className="font-headline-sm text-headline-sm mb-3">
            {clinic.doctors.length} doctor{clinic.doctors.length === 1 ? '' : 's'}
          </h2>
          <div className="flex flex-col gap-3">
            {clinic.doctors.map((d) => (
              <Link key={d.id} href={`/doctors/${d.slug}`} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                {d.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.photo_url} alt={d.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center shrink-0">
                    {d.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-label-lg text-label-lg truncate">{d.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{[d.qualification, d.specialty].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </Link>
            ))}
          </div>
        </div>

        <Link
          href={`/patient/${clinic.subdomain}/select-doctor`}
          className="h-14 px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2"
        >
          Get a digital queue token
        </Link>
      </div>
    </main>
  );
}
