import { NextResponse, type NextRequest } from 'next/server';

// Decision 42 (domains) — ONE shared subdomain for every clinic's patient pages, on any root domain
// (patient.clinicq.in, patient.praispranav.com, …): the clinic itself is identified by the path, same
// as it always has been on the main domain (/patient/<subdomain>/...), so this is a pure prefix-rewrite,
// not per-clinic routing — no DNS/Vercel work is ever needed again when a new clinic is created.
//   patient.clinicq.in/              → /patient              (patient home: regain a token, book again)
//   patient.clinicq.in/drkumar       → /patient/drkumar       (doctor selection)
//   patient.clinicq.in/drkumar/intake?... → /patient/drkumar/intake?... (where QR scans land)
// The bare root domain (clinicq.in) is untouched by this file — it's the marketing site.
// Locally: http://patient.localhost:3000 works with no DNS setup.

const PATIENT_SUBDOMAIN = 'patient';

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase();
  if (host.split('.')[0] !== PATIENT_SUBDOMAIN) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const url = req.nextUrl.clone();
  url.pathname = `/patient${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|.*\\.[a-z0-9]+$).*)'],
};
