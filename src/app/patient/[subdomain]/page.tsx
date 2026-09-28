import { redirect } from 'next/navigation';

// The clinic's QR standee points here (drkumar.medqr.in -> /patient/drkumar).
// First stop is always Doctor Selection (Screen #1A), which auto-confirms single-doctor clinics.
export default function PatientQrEntry({ params }: { params: { subdomain: string } }) {
  redirect(`/patient/${params.subdomain}/select-doctor`);
}
