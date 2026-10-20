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
  /** Substring/stem keywords for flexible matching across commas, hyphens, and spelling variations. */
  keywords: string[];
  /** Alternate slugs, short names, and common typos/searches for URL sharing and lookup. */
  aliases?: string[];
}

export const SPECIALTY_GROUPS: SpecialtyGroup[] = [
  {
    slug: 'general-physician',
    name: 'General Physician',
    plural: 'General Physicians',
    aliases: ['gp', 'physician', 'general-practitioner', 'internal-medicine', 'family-medicine', 'family-physician', 'general-medicine', 'doctor', 'mbbs', 'md'],
    keywords: ['physician', 'general pract', 'family pract', 'internal med', 'family med', 'general med'],
    matches: [
      'General Physician', 'General practitioner', 'Family practice physician', 'Physician and Surgeon',
      'General Physician and Surgeon', 'Emergency care physician', 'Occupational medical physician',
      'Medical group', 'Health consultant', "Men's health physician", 'Physician', 'Internal Medicine',
      'Consultant Physician', 'MD Physician', 'Family Doctor',
    ],
  },
  {
    slug: 'gynecologist',
    name: 'Gynecologist',
    plural: 'Gynecologists',
    aliases: ['gyne', 'gynae', 'gynec', 'gynaec', 'gynecology', 'gynaecology', 'gynaecologist', 'obstetrician', 'obstetrics', 'obgyn', 'ob-gyn', 'obs-gynae', 'obs-gyne', 'maternity', 'women', 'womens-health', 'women-health'],
    keywords: ['gynec', 'gynaec', 'obstet', 'matern', 'fertility', 'ivf', 'women'],
    matches: [
      'Gynecologist', 'Gynaecologist', 'Obstetrician', 'Obstetrician and Gynecologist', 'Obstetrician & Gynaecologist',
      'Obstetrician-Gynecologist', 'Obstetrician-gynecologist', "Women's health clinic", 'Maternity hospital',
      'Fertility clinic', 'IVF clinic', 'Obs & Gynae', 'Obs & Gyne', 'Obstetrics and Gynaecology', 'Obstetrics & Gynecology',
      'Obstetrics', 'Gynecology', 'Gynaecology',
    ],
  },
  {
    slug: 'dentist',
    name: 'Dentist',
    plural: 'Dentists',
    aliases: ['dental', 'dentistry', 'teeth', 'tooth', 'orthodontist', 'dental-surgeon', 'bds', 'mds'],
    keywords: ['dent', 'orthodont', 'teeth', 'tooth', 'oral'],
    matches: [
      'Dentist', 'Dental clinic', 'Orthodontist', 'Dental hospital', 'Dental surgeon', 'Cosmetic dentist',
      'Pediatric dentist', 'Endodontist', 'Periodontist',
    ],
  },
  {
    slug: 'pediatrician',
    name: 'Pediatrician',
    plural: 'Pediatricians',
    aliases: ['pedia', 'paedia', 'pediatric', 'paediatric', 'pediatrics', 'paediatrics', 'paediatrician', 'child', 'children', 'infant', 'baby', 'newborn', 'neonatal', 'child-specialist'],
    keywords: ['pediat', 'paediat', 'child', 'newborn', 'infant', 'neonat'],
    matches: [
      'Pediatrician', 'Paediatrician', 'Child health care center', "Children's hospital",
      'General Physician and Child Specilist', 'Child Specialist', 'Pediatric clinic', 'Neonatologist',
    ],
  },
  {
    slug: 'orthopedic-doctor',
    name: 'Orthopedic Doctor',
    plural: 'Orthopedic Doctors',
    aliases: ['ortho', 'orthopedic', 'orthopaedic', 'orthopedics', 'orthopaedics', 'bone', 'joint', 'joint-replacement', 'spine', 'fracture'],
    keywords: ['orthop', 'bone', 'joint', 'spine', 'fracture', 'arthro'],
    matches: [
      'Orthopedic surgeon', 'Orthopaedic surgeon', 'Orthopedic clinic', 'Orthopaedic clinic',
      'Orthopedist', 'Orthopaedist', 'Bone Specialist', 'Joint Replacement Surgeon', 'Spine Specialist',
    ],
  },
  {
    slug: 'ent-specialist',
    name: 'ENT Specialist',
    plural: 'ENT Specialists',
    aliases: ['ent', 'ear-nose-throat', 'otolaryngologist', 'otolaryngology', 'ear', 'nose', 'throat'],
    keywords: ['ent', 'otolaryng', 'ear', 'nose', 'throat'],
    matches: [
      'Otolaryngologist', 'Otolaryngology clinic', 'Head and neck surgeon', 'ENT', 'ENT Specialist',
      'ENT Surgeon', 'Ear Nose Throat',
    ],
  },
  {
    slug: 'dermatologist',
    name: 'Dermatologist',
    plural: 'Dermatologists',
    aliases: ['derma', 'dermatology', 'skin', 'hair', 'cosmetology', 'cosmetologist', 'trichology', 'trichologist', 'skin-specialist'],
    keywords: ['dermat', 'skin', 'cosmetol', 'trichol', 'hair'],
    matches: [
      'Dermatologist', 'Skin care clinic', 'Skin specialist', 'Cosmetologist', 'Trichologist',
      'Hair specialist', 'Dermatology clinic',
    ],
  },
  {
    slug: 'eye-specialist',
    name: 'Eye Specialist',
    plural: 'Eye Specialists',
    aliases: ['eye', 'eye-doctor', 'ophthalmology', 'ophthalmologist', 'cataract', 'vision', 'retina', 'cornea'],
    keywords: ['ophthalm', 'eye', 'cataract', 'retina', 'cornea', 'vision', 'glaucoma'],
    matches: [
      'Ophthalmologist', 'Eye care center', 'Eye specialist', 'Eye doctor', 'Eye hospital',
      'Cataract surgeon', 'Retina specialist',
    ],
  },
  {
    slug: 'cardiologist',
    name: 'Cardiologist',
    plural: 'Cardiologists',
    aliases: ['cardio', 'cardiology', 'heart', 'heart-specialist', 'cardiac'],
    keywords: ['cardio', 'heart', 'cardiac', 'vascular', 'coronary'],
    matches: [
      'Cardiologist', 'Cardiovascular and thoracic surgeon', 'Heart specialist', 'Cardiac surgeon',
      'Interventional cardiologist',
    ],
  },
  {
    slug: 'neurologist',
    name: 'Neurologist',
    plural: 'Neurologists',
    aliases: ['neuro', 'neurology', 'brain', 'nerves', 'nerve-specialist', 'brain-specialist'],
    keywords: ['neurolog', 'brain', 'nerves', 'stroke', 'epilepsy'],
    matches: ['Neurologist', 'Neurology clinic', 'Brain specialist', 'Nerve specialist'],
  },
  {
    slug: 'neurosurgeon',
    name: 'Neurosurgeon',
    plural: 'Neurosurgeons',
    aliases: ['neurosurgery', 'brain-surgeon', 'spine-surgeon'],
    keywords: ['neurosurgeon', 'neurosurg'],
    matches: ['Neurosurgeon', 'Neurosurgery clinic', 'Brain and spine surgeon'],
  },
  {
    slug: 'psychiatrist',
    name: 'Psychiatrist',
    plural: 'Psychiatrists',
    aliases: ['psychiatry', 'mental-health', 'psychologist', 'counseling', 'depression'],
    keywords: ['psychiat', 'psychol', 'mental health', 'counsel'],
    matches: [
      'Psychiatrist', 'Psychiatric hospital', 'Psychoneurological specialized clinic', 'Mental health clinic',
      'Clinical psychologist',
    ],
  },
  {
    slug: 'urologist',
    name: 'Urologist',
    plural: 'Urologists',
    aliases: ['urology', 'kidney-stone', 'urinary', 'uro'],
    keywords: ['urolog', 'urinar', 'kidney stone'],
    matches: ['Urologist', 'Urology clinic', 'Urological surgeon'],
  },
  {
    slug: 'nephrologist',
    name: 'Nephrologist',
    plural: 'Nephrologists',
    aliases: ['nephrology', 'kidney', 'dialysis', 'kidney-specialist'],
    keywords: ['nephrol', 'dialysis', 'kidney'],
    matches: ['Nephrologist', 'Nephrology clinic', 'Kidney specialist', 'Dialysis center'],
  },
  {
    slug: 'gastroenterologist',
    name: 'Gastroenterologist',
    plural: 'Gastroenterologists',
    aliases: ['gastro', 'gastroenterology', 'liver', 'digestive', 'stomach', 'hepatologist'],
    keywords: ['gastro', 'hepatol', 'liver', 'digest', 'stomach', 'endoscop'],
    matches: ['Gastroenterologist', 'Gastroenterology clinic', 'Hepatologist', 'Liver specialist', 'GI surgeon'],
  },
  {
    slug: 'pulmonologist',
    name: 'Chest Specialist',
    plural: 'Chest Specialists',
    aliases: ['pulmonology', 'chest', 'respiratory', 'lungs', 'asthma', 'chest-specialist', 'pulmonologist'],
    keywords: ['pulmon', 'chest', 'respirat', 'lungs', 'asthma'],
    matches: ['Pulmonologist', 'Chest Specialist', 'Chest physician', 'Respiratory medicine'],
  },
  {
    slug: 'oncologist',
    name: 'Oncologist',
    plural: 'Oncologists',
    aliases: ['oncology', 'cancer', 'tumor', 'cancer-specialist', 'chemo'],
    keywords: ['oncol', 'cancer', 'tumor', 'chemo'],
    matches: ['Oncologist', 'Cancer specialist', 'Radiation oncologist', 'Surgical oncologist', 'Medical oncologist'],
  },
  {
    slug: 'diabetologist',
    name: 'Diabetologist',
    plural: 'Diabetologists',
    aliases: ['diabetes', 'diabetic', 'sugar', 'sugar-specialist', 'endocrinologist', 'endocrine', 'thyroid'],
    keywords: ['diabet', 'sugar', 'endocrin', 'thyroid'],
    matches: ['Diabetologist', 'Diabetes specialist', 'Endocrinologist', 'Thyroid specialist'],
  },
  {
    slug: 'general-surgeon',
    name: 'General Surgeon',
    plural: 'General Surgeons',
    aliases: ['surgeon', 'surgery', 'laparoscopic-surgeon', 'laparoscopy'],
    keywords: ['surgeon', 'surgery', 'laparoscop', 'hernia'],
    matches: ['Surgeon', 'General surgeon', 'Laparoscopic surgeon'],
  },
  {
    slug: 'plastic-surgeon',
    name: 'Plastic Surgeon',
    plural: 'Plastic Surgeons',
    aliases: ['plastic-surgery', 'cosmetic-surgeon', 'cosmetic-surgery'],
    keywords: ['plastic surg', 'cosmetic surg'],
    matches: ['Plastic surgery clinic', 'Plastic surgeon', 'Cosmetic surgeon'],
  },
  {
    slug: 'physiotherapist',
    name: 'Physiotherapist',
    plural: 'Physiotherapists',
    aliases: ['physiotherapy', 'physical-therapy', 'rehab', 'physio'],
    keywords: ['physiotherap', 'physical therap', 'rehab'],
    matches: ['Physical therapist', 'Physical therapy clinic', 'Physiotherapist', 'Physiotherapy clinic'],
  },
  {
    slug: 'homeopath',
    name: 'Homeopathic Doctor',
    plural: 'Homeopathic Doctors',
    aliases: ['homeopathy', 'homeopathic', 'homoeopathy', 'homoeopath', 'bhms'],
    keywords: ['homeopath', 'homoeopath', 'bhms'],
    matches: ['Homeopath', 'Homeopathic doctor', 'Homoeopathic clinic', 'Homeopathy clinic'],
  },
  {
    slug: 'ayurvedic-doctor',
    name: 'Ayurvedic Doctor',
    plural: 'Ayurvedic Doctors',
    aliases: ['ayurveda', 'ayurvedic', 'vaidya', 'bams'],
    keywords: ['ayurved', 'vaidya', 'bams'],
    matches: ['Ayurvedic clinic', 'Alternative medicine practitioner', 'Ayurvedic doctor', 'Vaidya'],
  },
  {
    slug: 'pain-specialist',
    name: 'Pain Specialist',
    plural: 'Pain Specialists',
    aliases: ['pain', 'pain-management'],
    keywords: ['pain'],
    matches: ['Pain management physician', 'Pain specialist', 'Pain clinic'],
  },
];

/** Normalize spelling stems, e.g. gynae -> gyne, paedia -> pedia, orthopae -> orthope */
export function normalizeSpecialtyStem(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/gynae/g, 'gyne')
    .replace(/paedia/g, 'pedia')
    .replace(/orthopae/g, 'orthope')
    .replace(/homoeo/g, 'homeo')
    .replace(/[&]/g, ' and ')
    .replace(/[-_/\\|;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a compound/multi-specialty string into individual clean components */
export function splitSpecialtyParts(raw?: string | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split(/[,;\n|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Match a single specialty phrase or item against a SpecialtyGroup */
export function matchesGroup(part: string, g: SpecialtyGroup): boolean {
  if (!part) return false;
  const rawLower = part.trim().toLowerCase();
  const normalized = normalizeSpecialtyStem(part);

  // Exact match with configured matches
  if (g.matches.some((m) => m.toLowerCase() === rawLower || normalizeSpecialtyStem(m) === normalized)) {
    return true;
  }

  // Keyword / stem matching
  for (const kw of g.keywords) {
    const kwNorm = normalizeSpecialtyStem(kw);
    if (normalized.includes(kwNorm) || rawLower.includes(kw.toLowerCase())) {
      return true;
    }
  }

  // Check aliases
  if (g.aliases) {
    for (const a of g.aliases) {
      const aNorm = normalizeSpecialtyStem(a);
      if (normalized === aNorm || normalized.includes(aNorm)) {
        return true;
      }
    }
  }

  return false;
}

/** Find all SpecialtyGroups that match any part of a doctor's specialty string */
export function groupsOf(specialty?: string | null): SpecialtyGroup[] {
  if (!specialty) return [];
  const parts = splitSpecialtyParts(specialty);
  if (!parts.length) parts.push(specialty);

  const matched: SpecialtyGroup[] = [];
  for (const g of SPECIALTY_GROUPS) {
    if (parts.some((p) => matchesGroup(p, g)) || matchesGroup(specialty, g)) {
      matched.push(g);
    }
  }
  return matched;
}

/** Primary group a stored specialty belongs to (null = not grouped) */
export function groupOf(specialty?: string | null): SpecialtyGroup | null {
  const all = groupsOf(specialty);
  return all.length ? all[0] : null;
}

/** Resolve a group from a slug, alias, name, or search query (e.g. 'gyne', 'gynaecologist', 'dentist') */
export function groupBySlug(slugOrAlias?: string | null): SpecialtyGroup | null {
  if (!slugOrAlias) return null;
  const raw = slugOrAlias.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!raw) return null;

  // 1. Direct slug match
  const direct = SPECIALTY_GROUPS.find((g) => g.slug === raw);
  if (direct) return direct;

  // 2. Direct alias match
  const aliasMatch = SPECIALTY_GROUPS.find((g) => g.aliases?.some((a) => a === raw || a.replace(/[^a-z0-9]+/g, '-') === raw));
  if (aliasMatch) return aliasMatch;

  // 3. Normalized stem/keyword match
  const stem = normalizeSpecialtyStem(slugOrAlias);
  for (const g of SPECIALTY_GROUPS) {
    if (matchesGroup(slugOrAlias, g)) return g;
    if (g.slug.replace(/-/g, ' ').includes(stem) || stem.includes(g.slug.replace(/-/g, ' '))) return g;
    if (g.name.toLowerCase().includes(stem)) return g;
  }

  return null;
}

/** "Sitamarhi" -> "sitamarhi", "Punaura Pashchim" -> "punaura-pashchim". */
export const placeSlug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
