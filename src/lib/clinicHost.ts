// Decision 56 (domains) — which kind of host a request is on. The same app runs on more than one root
// domain at once (clinicq.fit AND clinicq.in); each root has the same four kinds of host:
//   clinicq.fit / www.clinicq.fit  → main site (marketing, /doctors search, staff /login)
//   patient.clinicq.fit            → the patient origin (every intake, token and patient login)
//   drkumar.clinicq.fit            → that clinic's own home page + staff login with no clinic code
//   api.clinicq.fit                → the backend (one server behind every root's api. name)
// plus legacy hosts (praispranav) that are only kept so printed QR codes (/q/<code>) keep working.
//
// A link always stays on the root domain the visitor is already on (someone on drkumar.clinicq.in gets
// patient.clinicq.in, not .fit) — a patient's saved session and a staff member's session cookie both
// belong to one site. Hosts on no known root (legacy, server-side renders) use the PRIMARY root: the
// first of NEXT_PUBLIC_ROOT_DOMAINS, matching NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_PATIENT_SITE_URL.
//
// Locally the root is "localhost", so drkumar.localhost:3000 and patient.localhost:3000 work without
// DNS, and nothing is redirected (the site URLs are unset).

export const ROOT_DOMAINS = (process.env.NEXT_PUBLIC_ROOT_DOMAINS || process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
/** The primary root domain ("clinicq.fit"). */
export const ROOT_DOMAIN = ROOT_DOMAINS[0] ?? 'localhost';
export const PATIENT_SUBDOMAIN = 'patient';
const API_SUBDOMAIN = (process.env.NEXT_PUBLIC_API_SUBDOMAIN ?? '').trim().toLowerCase();
// Keep in sync with RESERVED_SUBDOMAINS in the backend's admin.service.ts — a clinic can never take these.
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'go', 'mail', 'static', 'assets', PATIENT_SUBDOMAIN]);

const trim = (u: string | undefined) => (u ?? '').trim().replace(/\/$/, '');

/** https://patient.clinicq.fit — unset (local dev / old deploys) → patient pages stay on the current host. */
export const PATIENT_SITE_URL = trim(process.env.NEXT_PUBLIC_PATIENT_SITE_URL);
/** https://clinicq.fit — the primary main site. */
export const MAIN_SITE_URL = trim(process.env.NEXT_PUBLIC_SITE_URL);
/** Old hosts that only serve QR redirects now, e.g. "medqr.praispranav.com,clinicq.praispranav.com". */
export const LEGACY_HOSTS = (process.env.NEXT_PUBLIC_LEGACY_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const bareHost = (host: string) => host.split(':')[0].toLowerCase();
const browserHost = () => (typeof window !== 'undefined' ? window.location.host : null);

/** Which of our root domains a host belongs to ("drkumar.clinicq.in" → "clinicq.in"), or null. */
export function rootOf(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = bareHost(host);
  let best: string | null = null;
  for (const root of ROOT_DOMAINS) {
    if ((h === root || h.endsWith(`.${root}`)) && (!best || root.length > best.length)) best = root;
  }
  return best;
}

/** The clinic code for a host like "drkumar.clinicq.fit" (port ignored), or null on any other host. */
export function clinicFromHost(host: string): string | null {
  const root = rootOf(host);
  const h = bareHost(host);
  if (!root || h === root) return null;
  const sub = h.slice(0, -(root.length + 1));
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub) || RESERVED.has(sub)) return null;
  return sub;
}

export const isPatientHost = (host: string) => bareHost(host).split('.')[0] === PATIENT_SUBDOMAIN;
export const isLegacyHost = (host: string) => LEGACY_HOSTS.includes(bareHost(host));

/** The main / patient site for the root domain `host` is on; the primary one when it's on none. */
function siteBase(kind: 'main' | 'patient', host: string | null | undefined): string | null {
  const primary = kind === 'main' ? MAIN_SITE_URL : PATIENT_SITE_URL;
  if (!primary) return null;
  const root = rootOf(host);
  if (!root || root === 'localhost') return primary;
  const protocol = primary.startsWith('http://') ? 'http:' : 'https:';
  return kind === 'main' ? `${protocol}//${root}` : `${protocol}//${PATIENT_SUBDOMAIN}.${root}`;
}

/**
 * A link into a patient flow. `path` is the app path ("/patient/drkumar/intake?doctorId=…"). With
 * NEXT_PUBLIC_PATIENT_SITE_URL set, it becomes an absolute patient-site URL on the visitor's root
 * domain with the "/patient" prefix dropped (patient.clinicq.fit/drkumar/intake?…). Unset → the path
 * as-is (same host). `host` defaults to the browser's; server components pass the request's Host,
 * client components pass `useHost()` so the server and first browser render agree.
 */
export function patientUrl(path: string, host: string | null | undefined = browserHost()): string {
  const base = siteBase('patient', host);
  if (!base) return path;
  const rest = path.replace(/^\/patient(?=\/|$|\?)/, '');
  return `${base}${rest || '/'}`;
}

/** A link to the main site (e.g. /doctors search from the patient site). Unset → same host. */
export function mainUrl(path: string, host: string | null | undefined = browserHost()): string {
  const base = siteBase('main', host);
  return base ? `${base}${path}` : path;
}

/**
 * A clinic's own address (https://drkumar.clinicq.fit/login) — the link to hand doctors and reception
 * so they log in without typing the clinic code. Null until clinic subdomains are switched on
 * (NEXT_PUBLIC_ROOT_DOMAINS + NEXT_PUBLIC_SITE_URL set); callers then fall back to /login?clinic=.
 */
export function clinicSiteUrl(subdomain: string, path = '/', host: string | null | undefined = browserHost()): string | null {
  if (!MAIN_SITE_URL || ROOT_DOMAIN === 'localhost') return null;
  const root = rootOf(host) ?? ROOT_DOMAIN;
  const protocol = MAIN_SITE_URL.startsWith('http://') ? 'http:' : 'https:';
  return `${protocol}//${subdomain}.${root}${path}`;
}

/**
 * The API address for calls that carry the staff/admin session cookie. The cookie is SameSite=Lax and
 * belongs to the API host, so a page on clinicq.in must call api.clinicq.in (the same server) — calling
 * api.clinicq.fit from there is cross-site and the browser would leave the cookie off. With
 * NEXT_PUBLIC_API_SUBDOMAIN unset, or on a host of no known root, the configured API address is used.
 */
export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  const host = browserHost();
  const root = rootOf(host);
  if (!API_SUBDOMAIN || !root || root === 'localhost') return configured;
  return `${window.location.protocol}//${API_SUBDOMAIN}.${root}`;
}
