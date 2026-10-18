/**
 * Decision 66 — the specialties patients actually search for ("dentist in Patna", "ENT specialist"), each
 * covering the Google Maps categories our listings came with ("Otolaryngologist", "Dental clinic", …).
 * Used for directory filters, SEO landing pages (/doctors/in/<city>/<slug>) and the sitemap.
 * Keep in sync with backend/src/common/specialty-groups.ts.
 */
export interface SpecialtyGroup {
  slug: string;
  /** Singular, as a patient searches it. */
  name: string;
  /** Plural for page titles ("Dentists in Patna"). */
  plural: string;
  /** Stored `doctors.specialty` values (case-insensitive) that belong here. */
  matches: string[];
}

export const SPECIALTY_GROUPS: SpecialtyGroup[] = [
  { slug: 'general-physician', name: 'General Physician', plural: 'General Physicians', matches: ['General Physician', 'General practitioner', 'Family practice physician', 'Physician and Surgeon', 'General Physician and Surgeon', 'Emergency care physician', 'Occupational medical physician', 'Medical group', 'Health consultant', "Men's health physician", 'Physician'] },
  { slug: 'dentist', name: 'Dentist', plural: 'Dentists', matches: ['Dentist', 'Dental clinic', 'Orthodontist', 'Dental hospital'] },
  { slug: 'gynecologist', name: 'Gynecologist', plural: 'Gynecologists', matches: ['Gynecologist', 'Obstetrician and Gynecologist', 'Obstetrician-gynecologist', "Women's health clinic", 'Maternity hospital', 'Fertility clinic', 'IVF clinic'] },
  { slug: 'pediatrician', name: 'Pediatrician', plural: 'Pediatricians', matches: ['Pediatrician', 'Child health care center', "Children's hospital", 'General Physician and Child Specilist'] },
  { slug: 'orthopedic-doctor', name: 'Orthopedic Doctor', plural: 'Orthopedic Doctors', matches: ['Orthopedic surgeon', 'Orthopedic clinic', 'Orthopedist'] },
  { slug: 'ent-specialist', name: 'ENT Specialist', plural: 'ENT Specialists', matches: ['Otolaryngologist', 'Otolaryngology clinic', 'Head and neck surgeon', 'ENT'] },
  { slug: 'dermatologist', name: 'Dermatologist', plural: 'Dermatologists', matches: ['Dermatologist', 'Skin care clinic'] },
  { slug: 'eye-specialist', name: 'Eye Specialist', plural: 'Eye Specialists', matches: ['Ophthalmologist', 'Eye care center'] },
  { slug: 'cardiologist', name: 'Cardiologist', plural: 'Cardiologists', matches: ['Cardiologist', 'Cardiovascular and thoracic surgeon'] },
  { slug: 'neurologist', name: 'Neurologist', plural: 'Neurologists', matches: ['Neurologist'] },
  { slug: 'neurosurgeon', name: 'Neurosurgeon', plural: 'Neurosurgeons', matches: ['Neurosurgeon'] },
  { slug: 'psychiatrist', name: 'Psychiatrist', plural: 'Psychiatrists', matches: ['Psychiatrist', 'Psychiatric hospital', 'Psychoneurological specialized clinic'] },
  { slug: 'urologist', name: 'Urologist', plural: 'Urologists', matches: ['Urologist'] },
  { slug: 'nephrologist', name: 'Nephrologist', plural: 'Nephrologists', matches: ['Nephrologist'] },
  { slug: 'gastroenterologist', name: 'Gastroenterologist', plural: 'Gastroenterologists', matches: ['Gastroenterologist'] },
  { slug: 'pulmonologist', name: 'Chest Specialist', plural: 'Chest Specialists', matches: ['Pulmonologist'] },
  { slug: 'oncologist', name: 'Oncologist', plural: 'Oncologists', matches: ['Oncologist'] },
  { slug: 'diabetologist', name: 'Diabetologist', plural: 'Diabetologists', matches: ['Diabetologist'] },
  { slug: 'general-surgeon', name: 'General Surgeon', plural: 'General Surgeons', matches: ['Surgeon', 'General surgeon'] },
  { slug: 'plastic-surgeon', name: 'Plastic Surgeon', plural: 'Plastic Surgeons', matches: ['Plastic surgery clinic', 'Plastic surgeon'] },
  { slug: 'physiotherapist', name: 'Physiotherapist', plural: 'Physiotherapists', matches: ['Physical therapist', 'Physical therapy clinic', 'Physiotherapist'] },
  { slug: 'homeopath', name: 'Homeopathic Doctor', plural: 'Homeopathic Doctors', matches: ['Homeopath'] },
  { slug: 'ayurvedic-doctor', name: 'Ayurvedic Doctor', plural: 'Ayurvedic Doctors', matches: ['Ayurvedic clinic', 'Alternative medicine practitioner'] },
  { slug: 'pain-specialist', name: 'Pain Specialist', plural: 'Pain Specialists', matches: ['Pain management physician'] },
];

export const groupBySlug = (slug?: string | null) => SPECIALTY_GROUPS.find((g) => g.slug === slug) ?? null;

/** Which group a stored specialty belongs to (null = not grouped, e.g. "Nursing home"). */
export function groupOf(specialty?: string | null): SpecialtyGroup | null {
  const s = (specialty ?? '').trim().toLowerCase();
  if (!s) return null;
  return SPECIALTY_GROUPS.find((g) => g.matches.some((m) => m.toLowerCase() === s)) ?? null;
}

/** "Sitamarhi" -> "sitamarhi", "Punaura Pashchim" -> "punaura-pashchim". */
export const placeSlug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
