import Link from 'next/link';
import { PublicFooter } from '@/components/public/PublicFooter';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { fileUrl } from '@/lib/api';
import { VerifiedBadge } from '@/components/directory/VerifiedBadge';
import { ClaimBox } from './ClaimBox';
import { VISIT_TIPS, WHY, directionsUrl, initials, orderedDoctors, telHref, tokenHref, type LandingProps } from './landingData';

// Template 3 — "Classic": plain white, one narrow column, small headings. The simplest page: name, how to reach the
// clinic, the doctors in a list, hours and fee on one line each.

const btn = 'h-11 px-5 rounded-md bg-[#166534] hover:bg-[#14532D] text-white font-label-lg text-label-lg flex items-center justify-center gap-2';
const ghost = 'h-11 px-4 rounded-md border border-[#166534]/30 text-[#166534] font-label-lg text-label-lg flex items-center justify-center gap-2';

export function ClassicLanding({ clinic, focusSlug, staffLoginHref, host }: LandingProps) {
  const doctors = orderedDoctors(clinic, focusSlug);
  const maps = directionsUrl(clinic);
  const tel = telHref(clinic.public_phone);
  const canBook = clinic.booking_open !== false;
  const place = [clinic.address, clinic.city].filter(Boolean).join(', ');
  const points = canBook ? WHY : VISIT_TIPS;

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <header className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-4">
          <BrandLogo />
          {staffLoginHref ? <Link href={staffLoginHref} className="ml-auto text-[#166534] font-label-md text-label-md">Login</Link> : <Link href="/doctors" className="ml-auto text-gray-600 font-label-md text-label-md">All doctors</Link>}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h1 className="font-headline-lg text-headline-lg">{clinic.clinic_name}</h1>
          {clinic.verified && <div><VerifiedBadge size="md" /></div>}
          {clinic.tagline && <p className="font-body-lg text-body-lg text-gray-700">{clinic.tagline}</p>}
          {place && <p className="font-body-md text-body-md text-gray-600">{place}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {canBook && <Link href={tokenHref(clinic, doctors.length === 1 ? doctors[0] : null, host)} className={btn}>Get my token</Link>}
            {tel && <a href={tel} className={ghost}>Call {clinic.public_phone}</a>}
            {maps && <a href={maps} target="_blank" rel="noreferrer" className={ghost}>Directions</a>}
          </div>
        </section>

        {clinic.about && <section><h2 className="font-title-lg text-title-lg font-semibold mb-1">About</h2><p className="font-body-md text-body-md text-gray-700">{clinic.about}</p></section>}
        {clinic.highlights.length > 0 && (
          <ul className="list-disc pl-5 font-body-md text-body-md text-gray-700 flex flex-col gap-1">{clinic.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
        )}

        {doctors.length > 0 && (
          <section>
            <h2 className="font-title-lg text-title-lg font-semibold mb-3">{doctors.length === 1 ? 'Doctor' : 'Doctors'}</h2>
            <ul className="divide-y divide-gray-200 border-y border-gray-200">
              {doctors.map((d) => (
                <li key={d.id} className="py-4 flex gap-4">
                  {d.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(d.photo_url)} alt={d.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#DCFCE7] text-[#166534] font-title-md flex items-center justify-center shrink-0">{initials(d.name)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-title-md text-title-md font-semibold">{d.name}</p>
                    <p className="font-body-sm text-body-sm text-gray-600">{[d.qualification, d.specialty, d.experience_years ? `${d.experience_years} years` : null].filter(Boolean).join(' · ')}</p>
                    {d.bio && <p className="font-body-sm text-body-sm text-gray-700 mt-1">{d.bio}</p>}
                    {(d.fee_inr || d.hours) && <p className="font-body-sm text-body-sm text-gray-700 mt-1">{[d.fee_inr ? `Fee ₹${d.fee_inr.toLocaleString('en-IN')}` : null, d.hours].filter(Boolean).join(' · ')}</p>}
                    {canBook && <Link href={tokenHref(clinic, d, host)} className="inline-block mt-2 text-[#166534] font-label-md text-label-md underline underline-offset-4">Get a token</Link>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="font-title-lg text-title-lg font-semibold mb-2">{canBook ? 'How a token helps you' : 'Before you visit'}</h2>
          <ul className="flex flex-col gap-2">
            {points.map((w) => <li key={w.title} className="font-body-md text-body-md"><b>{w.title}.</b> <span className="text-gray-700">{w.body}</span></li>)}
          </ul>
        </section>

        {!canBook && <ClaimBox code={clinic.subdomain} />}
      </div>
      <PublicFooter clinicCode={clinic.subdomain} />
    </main>
  );
}
