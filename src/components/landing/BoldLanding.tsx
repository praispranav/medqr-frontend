import { ClinicVisitDetails } from './ClinicVisitDetails';
import Link from 'next/link';
import { PublicFooter } from '@/components/public/PublicFooter';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { fileUrl } from '@/lib/api';
import { VerifiedBadge } from '@/components/directory/VerifiedBadge';
import { ClaimBox } from './ClaimBox';
import { VISIT_TIPS, WHY, directionsUrl, initials, orderedDoctors, telHref, tokenHref, type LandingProps } from './landingData';

// Template 4 — "Bold": a deep-green header with the clinic name and the main action, mint page, white cards, and a
// fixed bottom action bar on phones (most patients arrive from a phone).

export function BoldLanding({ clinic, focusSlug, staffLoginHref, host }: LandingProps) {
  const doctors = orderedDoctors(clinic, focusSlug);
  const maps = directionsUrl(clinic);
  const tel = telHref(clinic.public_phone);
  const emTel = telHref(clinic.emergency_phone ?? null);
  const canBook = clinic.booking_open !== false;
  const points = canBook ? WHY : VISIT_TIPS;
  const mainHref = tokenHref(clinic, doctors.length === 1 ? doctors[0] : null, host);

  return (
    <main className="min-h-screen bg-[#ECFDF5] text-[#052E16] pb-24 md:pb-0">
      <section className="bg-[#064E3B] text-white">
        <div className="max-w-5xl mx-auto px-5">
          <div className="h-16 flex items-center gap-4"><BrandLogo />{staffLoginHref ? <Link href={staffLoginHref} className="ml-auto h-9 px-4 rounded-full bg-white/15 text-white font-label-md text-label-md flex items-center">Login</Link> : <Link href="/doctors" className="ml-auto text-white/80 font-label-md text-label-md">All doctors</Link>}</div>
          <div className="py-10 md:py-16 flex flex-col gap-4 max-w-3xl">
            <h1 className="text-[30px] leading-[37px] md:text-[44px] md:leading-[52px] font-bold">{clinic.clinic_name}</h1>
            {(clinic.verified || clinic.is_open_24x7) && <div className="flex flex-wrap items-center gap-2">
              {clinic.verified && <div><VerifiedBadge size="md" /></div>}
              {clinic.is_open_24x7 && (
                <span className="px-3 py-1 rounded-full bg-emerald-300 text-emerald-950 font-label-sm text-label-sm font-semibold flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-800 animate-pulse" />
                  Open 24/7 (All the time)
                </span>
              )}
            </div>}
            {clinic.tagline && <p className="text-[20px] leading-[30px] text-[#A7F3D0]">{clinic.tagline}</p>}
            {clinic.city && <p className="font-body-md text-body-md text-white/80">{clinic.city}</p>}
            <div className="hidden md:flex flex-wrap gap-3 pt-2">
              {canBook && <Link href={mainHref} className="h-14 px-8 rounded-full bg-white text-[#064E3B] font-label-lg text-label-lg flex items-center gap-2">Get my token</Link>}
              {tel && <a href={tel} className="h-14 px-6 rounded-full border border-white/40 text-white font-label-lg text-label-lg flex items-center gap-2">Call clinic</a>}
              {emTel && (
                <a href={emTel} className="h-14 px-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-label-lg text-label-lg flex items-center gap-2 font-semibold shadow-sm">
                  <span className="material-symbols-outlined text-[22px]">emergency</span> 24/7 Helpline: {clinic.emergency_phone}
                </a>
              )}

              {maps && <a href={maps} target="_blank" rel="noreferrer" className="h-14 px-6 rounded-full border border-white/40 text-white font-label-lg text-label-lg flex items-center gap-2">Directions</a>}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-5 py-10 flex flex-col gap-10">
        {(clinic.about || clinic.highlights.length > 0) && (
          <section className="bg-white rounded-xl p-6 flex flex-col gap-3 shadow-sm">
            {clinic.about && <p className="font-body-lg text-body-lg">{clinic.about}</p>}
            {clinic.highlights.length > 0 && <ul className="flex flex-wrap gap-2">{clinic.highlights.map((h) => <li key={h} className="px-3 py-1 rounded-full bg-[#D1FAE5] text-[#065F46] font-label-sm text-label-sm">{h}</li>)}</ul>}
          </section>
        )}

        {doctors.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-[26px] font-bold">{doctors.length === 1 ? 'Your doctor' : 'Our doctors'}</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {doctors.map((d) => (
                <article key={d.id} className="bg-white rounded-xl p-5 shadow-sm flex gap-4">
                  {d.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(d.photo_url)} alt={d.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-[#A7F3D0] text-[#064E3B] text-[26px] font-bold flex items-center justify-center shrink-0">{initials(d.name)}</div>
                  )}
                  <div className="min-w-0 flex flex-col gap-1">
                    <h3 className="text-[20px] font-bold">{d.name}</h3>
                    <p className="font-body-sm text-body-sm text-[#065F46]">{[d.qualification, d.specialty].filter(Boolean).join(' · ')}</p>
                    {d.experience_years ? <p className="font-body-sm text-body-sm">{d.experience_years} years in practice</p> : null}
                    {d.bio && <p className="font-body-sm text-body-sm text-[#052E16]/80">{d.bio}</p>}
                    {(d.fee_inr || d.hours) && <p className="font-body-sm text-body-sm font-semibold">{[d.fee_inr ? `₹${d.fee_inr.toLocaleString('en-IN')}` : null, d.hours].filter(Boolean).join(' · ')}</p>}
                    {canBook && <Link href={tokenHref(clinic, d, host)} className="self-start mt-1 h-10 px-4 rounded-full bg-[#047857] text-white font-label-md text-label-md flex items-center">Get a token</Link>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <ClinicVisitDetails clinic={clinic} doctors={doctors} className="bg-white" />

        <section className="flex flex-col gap-4">
          <h2 className="text-[26px] font-bold">{canBook ? 'How a token helps you' : 'Before you visit'}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {points.map((w) => (
              <div key={w.title} className="bg-white rounded-xl p-5 shadow-sm">
                <span className="material-symbols-outlined text-[#047857] text-[28px]">{w.icon}</span>
                <p className="font-title-md text-title-md font-bold mt-1">{w.title}</p>
                <p className="font-body-md text-body-md text-[#052E16]/75 mt-1">{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {!canBook && <ClaimBox code={clinic.subdomain} />}
      </div>

      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#064E3B]/15 p-3 flex gap-2 z-20">
        {canBook && <Link href={mainHref} className="flex-1 h-12 rounded-full bg-[#047857] text-white font-label-lg text-label-lg flex items-center justify-center">Get my token</Link>}
        {tel && <a href={tel} className="flex-1 h-12 rounded-full border border-[#047857] text-[#047857] font-label-lg text-label-lg flex items-center justify-center">Call</a>}
        {emTel && <a href={emTel} className="flex-1 h-12 rounded-full bg-rose-600 text-white font-label-lg text-label-lg flex items-center justify-center font-semibold">24/7 Helpline</a>}
        {!canBook && !tel && !emTel && maps && <a href={maps} target="_blank" rel="noreferrer" className="flex-1 h-12 rounded-full bg-[#047857] text-white font-label-lg text-label-lg flex items-center justify-center">Directions</a>}
      </div>
      <PublicFooter clinicCode={clinic.subdomain} />
    </main>
  );
}
