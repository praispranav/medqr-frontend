import type { Metadata } from 'next';

// Decision 58 — the clinic-facing marketing page lives here; the home page (/) is the patient & doctor search.
const title = 'ClinicQ for Clinics | Smart Clinic Queue Management & Digital OPD Tokens';
const description =
  'Transform your clinic with ClinicQ. Offer patients digital tokens, live WhatsApp queue updates, and seamless check-ins. No app required.';

export const metadata: Metadata = {
  title,
  description,
  keywords: 'clinic queue management system, digital OPD tokens, patient check-in software, doctor appointment system, smart clinic software',
  alternates: { canonical: '/for-clinics' },
  openGraph: { title, description, type: 'website' },
};

export default function ForClinicsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
