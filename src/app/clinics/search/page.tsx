import { redirect } from 'next/navigation';

export default function ClinicSearchRedirect({ searchParams }: { searchParams: { q?: string; city?: string; area?: string; bookable?: string; today?: string } }) {
  const p = new URLSearchParams();
  if (searchParams.q) p.set('q', searchParams.q);
  if (searchParams.city) p.set('city', searchParams.city);
  if (searchParams.area) p.set('area', searchParams.area);
  if (searchParams.bookable) p.set('bookable', searchParams.bookable);
  if (searchParams.today) p.set('today', searchParams.today);
  redirect(`/clinics${p.size ? `?${p}` : ''}`);
}
