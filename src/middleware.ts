import { NextResponse, type NextRequest } from 'next/server';
import { clinicFromHost, isLegacyHost, isPatientHost, mainUrl, MAIN_SITE_URL, PATIENT_SITE_URL, patientUrl } from '@/lib/clinicHost';

// Decision 56 (domains) — one Next.js app, four kinds of host on EACH root domain (clinicq.fit and
// clinicq.in alike — see lib/clinicHost.ts). Every redirect stays on the root the visitor is on;
// legacy hosts go to the primary root (clinicq.fit).
//
//   patient.clinicq.fit/                    → /patient                (patient home: login, old visits, book again)
//   patient.clinicq.fit/drkumar             → /patient/drkumar        (doctor selection)
//   patient.clinicq.fit/drkumar/intake?...  → /patient/drkumar/intake (where QR scans land)
//     The clinic is identified by the path, so no DNS work is needed for the patient site when a
//     clinic is created. Pages there still link with "/patient/..." paths — those pass straight through.
//
//   drkumar.clinicq.fit/                    → /clinic-home/drkumar    (the clinic's page, with a staff Login button)
//   drkumar.clinicq.fit/login, /reception…  → served as-is (staff work on their clinic's own address)
//
//   Patient flows are always sent to patient.clinicq.fit (NEXT_PUBLIC_PATIENT_SITE_URL) from every other
//   host: the patient's saved session lives in that ONE origin's storage, so it must never be split
//   across hosts.
//
//   Legacy hosts (praispranav) only serve /q/<code> for printed QR codes; everything else moves to the
//   main site.
//
// Locally nothing redirects (the site URLs are unset): http://patient.localhost:3000 and
// http://drkumar.localhost:3000 work with no DNS setup.

const NOINDEX = 'noindex, nofollow';

const redirect = (to: string) => NextResponse.redirect(to, 308);

const noindex = (res: NextResponse) => {
  // Transactional/private booking pages with zero SEO value. robots.txt's path rules (for /patient/...)
  // don't apply on the patient host — the browser never sends that prefix there.
  res.headers.set('X-Robots-Tag', NOINDEX);
  return res;
};

const isPatientPath = (p: string) => p === '/patient' || p.startsWith('/patient/');

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const { pathname, search } = req.nextUrl;

  // Printed QR codes and token pictures already handed out keep working on old hosts.
  if (isLegacyHost(host)) {
    if (pathname.startsWith('/q/') || pathname.startsWith('/token-image/')) return NextResponse.next();
    if (isPatientPath(pathname) && PATIENT_SITE_URL) return redirect(patientUrl(pathname + search, host));
    // patient.praispranav.com/<clinic>/... never had the /patient prefix in its paths.
    if (isPatientHost(host) && PATIENT_SITE_URL) return redirect(patientUrl(`/patient${pathname === '/' ? '' : pathname}${search}`, host));
    if (MAIN_SITE_URL) return redirect(mainUrl(pathname + search, host));
    return NextResponse.next();
  }

  if (isPatientHost(host)) {
    // The token screen fetches this shared image endpoint on the same host.
    if (pathname.startsWith('/token-image/') || pathname.startsWith('/q/')) return noindex(NextResponse.next());
    // Pages link with "/patient/<clinic>/..." app paths; show the clean address (patient.clinicq.fit/<clinic>/...)
    // instead of patient.clinicq.fit/patient/<clinic>/... — the clean path is rewritten back just below.
    if (isPatientPath(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.slice('/patient'.length) || '/';
      return NextResponse.redirect(url, 308);
    }
    // Public main-site pages (doctor search, policies) belong on the main site.
    if (MAIN_SITE_URL && /^\/(doctors|clinics|privacy|terms|contact|login)(\/|$)/.test(pathname)) {
      return redirect(mainUrl(pathname + search, host));
    }
    const url = req.nextUrl.clone();
    url.pathname = `/patient${pathname === '/' ? '' : pathname}`;
    return noindex(NextResponse.rewrite(url));
  }

  const clinic = clinicFromHost(host);
  if (clinic) {
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = `/clinic-home/${clinic}`;
      return NextResponse.rewrite(url);
    }
    if (isPatientPath(pathname) && PATIENT_SITE_URL) return redirect(patientUrl(pathname + search, host));
    return NextResponse.next();
  }

  // Main site: intake/queue links (old WhatsApp messages, bookmarks) move to the patient site.
  if (isPatientPath(pathname) && PATIENT_SITE_URL) return redirect(patientUrl(pathname + search, host));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|.*\\.[a-z0-9]+$).*)'],
};
