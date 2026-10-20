/**
 * Title Case rule for Clinic and Doctor titles/names:
 * Only the first letter of each word is capital; all remaining letters are lowercase.
 * e.g. "DR. AMIT KUMAR" -> "Dr. Amit Kumar", "apollo clinic" -> "Apollo Clinic", "Dr. Kumar's Clinic" -> "Dr. Kumar's Clinic"
 */
export function toTitleCase(str: string): string {
  if (!str || typeof str !== 'string') return str;
  return str
    .toLowerCase()
    .replace(/(^|[^\w']|(?<=^|[\s])')([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase())
    .replace(/('|\u2019)[A-Z]/g, (m) => m.toLowerCase());
}
