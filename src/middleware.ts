import { NextResponse, type NextRequest } from 'next/server';
import { clinicFromHost } from '@/lib/clinicHost';

// Clinic subdomains → that clinic's patient pages.
//   drkumar.medqr.in/            → /patient/drkumar            (doctor selection)
//   drkumar.medqr.in/intake?...  → /patient/drkumar/intake?... (where admin-list QR scans land)
// NEXT_PUBLIC_ROOT_DOMAIN is the bare domain ("medqr.in"); locally "localhost", so
// http://drkumar.localhost:3000 works without any DNS setup.
// Anything else on a clinic subdomain (/patient/..., /login, /_next, …) passes through untouched (the
// login pre-fills that clinic's code), and
// the main domain is not affected at all — the clinic QR printed from the doctor portal keeps working.

const PATIENT_PATHS = /^\/(?:$|intake$|select-doctor$|payment$|arrive$|queue\/[^/]+$)/;

export function middleware(req: NextRequest) {
  const sub = clinicFromHost(req.headers.get('host') ?? '');
  if (!sub) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (!PATIENT_PATHS.test(pathname)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/patient/${sub}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|.*\\.[a-z0-9]+$).*)'],
};
