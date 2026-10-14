import type { DirectoryClinicProfile, DirectoryLandingDoctor } from '@/lib/api';

// Decision 50 — shared helpers for the two clinic landing-page templates. Everything shown comes from what the clinic
// really entered; nothing (reviews, ratings, patient counts, certifications) is invented.

export type LandingProps = { clinic: DirectoryClinicProfile; focusSlug?: string | null };

export const initials = (name: string) =>
  name
    .replace(/^dr\.?\s+/i, '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** The clinic's own Google Maps pin when it set one (Decision 41), else a plain Maps search for its address. */
export function directionsUrl(c: DirectoryClinicProfile): string | null {
  if (c.maps_url) return c.maps_url;
  const q = [c.clinic_name, c.address, c.city].filter(Boolean).join(', ');
  return c.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export const telHref = (phone: string | null) => (phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null);

export const tokenHref = (c: DirectoryClinicProfile, d?: DirectoryLandingDoctor | null) =>
  d ? `/patient/${c.subdomain}/intake?doctorId=${d.id}` : `/patient/${c.subdomain}/select-doctor`;

/** The doctor to feature first: the one whose page this is, else the first listed. */
export function orderedDoctors(c: DirectoryClinicProfile, focusSlug?: string | null) {
  const list = [...c.doctors];
  const i = focusSlug ? list.findIndex((d) => d.slug === focusSlug) : -1;
  if (i > 0) list.unshift(list.splice(i, 1)[0]);
  return list;
}

/** The same four true statements on both templates (all are things ClinicQ really does). */
export const WHY = [
  { icon: 'weekend', title: 'No crowded waiting room', body: 'Get your token on your phone and follow your turn live — wait where you are comfortable.' },
  { icon: 'phone_iphone', title: 'No app to install', body: 'It opens right in your phone’s browser. Just your name and mobile number.' },
  { icon: 'notifications_active', title: 'Turn alerts', body: 'Ask for an alert and your phone tells you when you are next and when it is your turn.' },
  { icon: 'receipt_long', title: 'Clear and simple', body: 'Your token, your doctor and the clinic’s details stay together on one page you can open any time.' },
] as const;

export function jsonLd(c: DirectoryClinicProfile) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: c.clinic_name,
    description: c.about ?? c.tagline ?? undefined,
    address: c.address ?? undefined,
    telephone: c.public_phone ?? undefined,
  };
}
