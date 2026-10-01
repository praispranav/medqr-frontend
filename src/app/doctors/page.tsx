import type { Metadata } from 'next';
import { DoctorsSearch } from './DoctorsSearch';

export const metadata: Metadata = {
  title: 'Find a doctor — MedQR',
  description: 'Search doctors and clinics by name, specialty or city, and join their digital queue — no app download.',
};

export default function DoctorsIndexPage({ searchParams }: { searchParams: { q?: string } }) {
  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-surface-container">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center">
          <span className="font-headline-sm text-headline-sm text-primary">MedQR</span>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg">Find a doctor</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Search by name, specialty or city, then join the queue instantly.</p>
        </div>
        <DoctorsSearch initialQ={searchParams.q} />
      </div>
    </main>
  );
}
