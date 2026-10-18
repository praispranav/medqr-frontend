import { redirect } from 'next/navigation';

export default function DoctorSearchRedirect({ searchParams }: { searchParams: { q?: string; city?: string; specialty?: string; online?: string } }) {
  const p = new URLSearchParams();
  if (searchParams.q) p.set('q', searchParams.q);
  if (searchParams.city) p.set('city', searchParams.city);
  if (searchParams.specialty) p.set('specialty', searchParams.specialty);
  if (searchParams.online) p.set('online', searchParams.online);
  redirect(`/doctors${p.size ? `?${p}` : ''}`);
}
