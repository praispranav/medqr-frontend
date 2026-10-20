import { publicWebLink } from '@/lib/publicLinks';
import { patientUrl } from '@/lib/clinicHost';
import type { DirectoryClinicProfile, DirectoryLandingDoctor } from '@/lib/api';

// Decision 50 — shared helpers for the two clinic landing-page templates. Everything shown comes from what the clinic
// really entered; nothing (reviews, ratings, patient counts, certifications) is invented.

export type LandingProps = {
  clinic: DirectoryClinicProfile;
  focusSlug?: string | null;
  /** Decision 56: only on the clinic's own subdomain (drkumar.clinicq.fit) — a staff Login button in the header. */
  staffLoginHref?: string | null;
  /** Decision 56: the request's Host, so "Get a token" stays on the visitor's domain (clinicq.in vs clinicq.fit). */
  host?: string | null;
};

export const initials = (name: string) =>
  name
    .replace(/^dr\.?\s+/i, '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** City is often already included in imported addresses. Keep it once. */
export function clinicAddress(c: Pick<DirectoryClinicProfile, 'address' | 'city'>): string {
  const address = c.address?.trim() ?? '';
  const city = c.city?.trim() ?? '';
  if (!address) return city;
  if (!city || address.toLocaleLowerCase('en-IN').includes(city.toLocaleLowerCase('en-IN'))) return address;
  return `${address}, ${city}`;
}

/** The clinic's own Google Maps pin when it set one (Decision 41), else a plain Maps search for its address. */
export function directionsUrl(c: DirectoryClinicProfile): string | null {
  if (c.maps_url) return c.maps_url;
  const q = [c.clinic_name, clinicAddress(c)].filter(Boolean).join(', ');
  return c.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export const telHref = (phone: string | null) => (phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null);
export const webHref = publicWebLink;

// Decision 56: always the patient site (patient.clinicq.fit), where the patient's saved session lives.
export const tokenHref = (c: DirectoryClinicProfile, d: DirectoryLandingDoctor | null | undefined, host: string | null | undefined) =>
  patientUrl(d ? `/patient/${c.subdomain}/intake?doctorId=${d.id}` : `/patient/${c.subdomain}/select-doctor`, host);

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

/**
 * Decision 66 — clinics WITHOUT online OPD booking: practical visit tips instead of token benefits we can't
 * deliver. These remain useful even when the clinic does not offer online tokens.
 */
export const VISIT_TIPS = [
  { icon: 'call', title: 'Call before you go', body: 'Timings can change on the day. A quick call to the clinic saves a wasted trip.' },
  { icon: 'near_me', title: 'Get directions', body: 'Open the clinic in Google Maps from this page for the exact route.' },
  { icon: 'description', title: 'Carry your papers', body: 'Bring old prescriptions and reports so the doctor sees your history.' },
  { icon: 'payments', title: 'Confirm consultation fees', body: 'Ask the clinic about consultation fees and payment options before your visit.' },
] as const;

export function jsonLd(c: DirectoryClinicProfile) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: c.clinic_name,
    description: c.about ?? c.tagline ?? undefined,
    url: webHref(c.website_url) ?? undefined,
    sameAs: Object.values(c.social_links ?? {}).map(webHref).filter((url): url is string => !!url),
    address: c.address ?? undefined,
    telephone: c.public_phone ?? c.emergency_phone ?? undefined,
    ...(c.is_open_24x7 ? { openingHours: 'Mo-Su 00:00-24:00', isAcceptingNewPatients: true } : {}),
  };
}
