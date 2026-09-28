import { NextResponse, type NextRequest } from 'next/server';

// Clinic subdomains → that clinic's patient pages.
//   drkumar.medqr.in/            → /patient/drkumar            (doctor selection)
//   drkumar.medqr.in/intake?...  → /patient/drkumar/intake?... (where admin-list QR scans land)
// NEXT_PUBLIC_ROOT_DOMAIN is the bare domain ("medqr.in"); locally "localhost", so
// http://drkumar.localhost:3000 works without any DNS setup.
// Anything else on a clinic subdomain (/patient/..., /login, /_next, …) passes through untouched, and
// the main domain is not affected at all — the clinic QR printed from the doctor portal keeps working.

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost').toLowerCase();
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'go']);
const PATIENT_PATHS = /^\/(?:$|intake$|select-doctor$|payment$|queue\/[^/]+$)/;

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase();
  if (!host.endsWith(`.${ROOT}`)) return NextResponse.next();
  const sub = host.slice(0, -(ROOT.length + 1));
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub) || RESERVED.has(sub)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (!PATIENT_PATHS.test(pathname)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/patient/${sub}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|.*\\.[a-z0-9]+$).*)'],
};
