// Clinic subdomains: drkumar.medqr.in → "drkumar". NEXT_PUBLIC_ROOT_DOMAIN is the bare domain
// ("medqr.in"); locally "localhost", so drkumar.localhost:3000 works without DNS. Shared by the
// middleware (patient pages) and the staff login (pre-filled clinic code).

export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost').toLowerCase();
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'go']);

/** The clinic code for a host like "drkumar.medqr.in" (port ignored), or null on the main domain. */
export function clinicFromHost(host: string): string | null {
  const h = host.split(':')[0].toLowerCase();
  if (!h.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const sub = h.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub) || RESERVED.has(sub)) return null;
  return sub;
}
