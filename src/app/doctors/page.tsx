import type { Metadata } from 'next';
import { DoctorsSearch } from './DoctorsSearch';

export async function generateMetadata({ searchParams }: { searchParams: { q?: string; city?: string } }): Promise<Metadata> {
  const specialty = searchParams.q ? searchParams.q.charAt(0).toUpperCase() + searchParams.q.slice(1) : 'Doctors';
  const citySuffix = searchParams.city ? ` in ${searchParams.city}` : '';

  return {
    title: `Best ${specialty}${citySuffix} - Book Online & Live Queue | MedQR`,
    description: `Find top-rated ${specialty}${citySuffix}. Get digital tokens, track live OPD waiting times, and skip the waiting room with MedQR.`,
    keywords: `Best ${specialty}${citySuffix}, online doctor appointment, live OPD status, digital token ${specialty}`,
    openGraph: {
      title: `Book ${specialty} Appointments | MedQR`,
      description: `Track live queues and book ${specialty}s instantly.`,
    }
  };
}

export default function DoctorsIndexPage({ searchParams }: { searchParams: { q?: string; city?: string } }) {

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "name": "Find Best Doctors and Clinics | MedQR",
    "description": "Directory of verified doctors offering digital OPD tokens and live queue tracking.",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      <header className="border-b border-surface-container">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center">
          <span className="font-headline-sm text-headline-sm text-primary">MedQR</span>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg">
            {searchParams.q ? `Best ${searchParams.q.charAt(0).toUpperCase() + searchParams.q.slice(1)}${searchParams.city ? ` in ${searchParams.city}` : ''}` : 'Find a doctor'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Search by name, specialty or city, then join the queue instantly.</p>
        </div>
        <DoctorsSearch initialQ={searchParams.q} />
      </div>
    </main>
  );
}
