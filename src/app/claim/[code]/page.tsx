import type { Metadata } from 'next';
import { ClaimForm } from './ClaimForm';

export const metadata: Metadata = {
  title: 'Claim or remove a clinic listing | ClinicQ',
  robots: { index: false, follow: false },
};

export default function ClaimPage({ params, searchParams }: { params: { code: string }; searchParams: { kind?: string; doctor?: string } }) {
  return <ClaimForm code={params.code} initialKind={searchParams.kind === 'remove' ? 'remove' : 'claim'} initialDoctor={searchParams.doctor} />;
}
