import type { Metadata } from 'next';
import Link from 'next/link';
import { DoctorsSearch } from './DoctorsSearch';
import { BrandLogo } from '@/components/brand/BrandLogo';

export async function generateMetadata({ searchParams }: { searchParams: { q?: string; city?: string; product?: string } }): Promise<Metadata> {
  const specialty = searchParams.q ? searchParams.q.charAt(0).toUpperCase() + searchParams.q.slice(1) : 'Doctors';
  const citySuffix = searchParams.city ? ` in ${searchParams.city}` : '';

  return {
    title: `Best ${specialty}${citySuffix} - Book Online & Live Queue | ClinicQ`,
    description: `Find ${specialty}${citySuffix}. Get digital tokens, track live OPD waiting times, and skip the waiting room with ClinicQ.`,
    keywords: `Best ${specialty}${citySuffix}, online doctor appointment, live OPD status, digital token ${specialty}`,
    alternates: { canonical: '/doctors' },
    openGraph: {
      title: `Book ${specialty} Appointments | ClinicQ`,
      description: `Track live queues and book ${specialty}s instantly.`,
    }
  };
}

export default function DoctorsIndexPage({ searchParams }: { searchParams: { q?: string; city?: string; product?: string } }) {

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "name": "Find Best Doctors and Clinics | ClinicQ",
    "description": "Browse doctors and their clinics. Online tokens are available at participating clinics.",
    "audience": {
      "@type": "Patient"
    },
    "about": {
      "@type": "MedicalSpecialty",
      "name": searchParams.q || "General"
    }
  };

  return (
    <main className="min-h-screen bg-surface">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData).replace(/</g, '\\u003c') }}
      />
      <header className="border-b border-surface-container">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <BrandLogo />
          <Link href="/clinics" className="ml-auto font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
            Find a clinic →
          </Link>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg">
            {searchParams.q ? `Best ${searchParams.q.charAt(0).toUpperCase() + searchParams.q.slice(1)}${searchParams.city ? ` in ${searchParams.city}` : ''}` : 'Find a doctor'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Search doctors by name, specialty or city and see their clinics. Online tokens are available at participating clinics.</p>
        </div>
        <DoctorsSearch initialQ={searchParams.q} initialCity={searchParams.city} initialProduct={searchParams.product} />
      </div>
    </main>
  );
}
