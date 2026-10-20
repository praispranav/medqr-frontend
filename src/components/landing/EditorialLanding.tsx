import { PublicFooter } from '@/components/public/PublicFooter';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { fileUrl, type DirectoryLandingDoctor } from '@/lib/api';
import { WHY, VISIT_TIPS, directionsUrl, initials, orderedDoctors, telHref, tokenHref, type LandingProps } from './landingData';
import { ClaimBox } from './ClaimBox';
import { ClinicReviews } from './ClinicReviews';
import { VerifiedBadge } from '@/components/directory/VerifiedBadge';

// Template 1 — "Warm Clinical Editorial": paper-toned canvas, serif (Newsreader) headlines, cream cards with hairline
// borders, evergreen teal buttons and amber trust badges. Calm, spacious, a little literary.

const serif = { fontFamily: "var(--font-newsreader), 'Newsreader', Georgia, serif" } as const;
const btn = 'h-12 px-6 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-[#FBFAF7] font-label-lg text-label-lg flex items-center justify-center gap-2 transition-colors';
const ghost = 'h-12 px-5 rounded-xl bg-[#F4F1EA] border border-[#0F766E]/20 text-[#0F766E] font-label-lg text-label-lg flex items-center justify-center gap-2';
const card = 'bg-[#F4F1EA] border border-[#1E293B]/[0.07] rounded-3xl shadow-[0_4px_20px_-2px_rgba(30,41,59,0.05)]';

export function EditorialLanding({ clinic, focusSlug, staffLoginHref, host }: LandingProps) {
  const doctors = orderedDoctors(clinic, focusSlug);
  const maps = directionsUrl(clinic);
  const tel = telHref(clinic.public_phone);
  const emTel = telHref(clinic.emergency_phone ?? null);
  const canBook = clinic.booking_open !== false; // Decision 60: only opted-in clinics take online tokens
  const place = [clinic.address, clinic.city].filter(Boolean).join(', ');

  return (
    <main className="min-h-screen bg-[#FBFAF7] text-[#1E293B]">
      <header className="border-b border-[#1E293B]/[0.07]">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center gap-4">
          <BrandLogo />
          {!staffLoginHref && <Link href="/doctors" className="ml-auto text-[#1E293B]/70 hover:text-[#1E293B] font-label-md text-label-md">All doctors</Link>}
          {staffLoginHref && <Link href={staffLoginHref} className="ml-auto h-10 px-4 rounded-xl border border-[#1E293B]/15 text-[#1E293B] font-label-md text-label-md flex items-center">Login</Link>}
          {canBook ? (
            <Link href={tokenHref(clinic, doctors.length === 1 ? doctors[0] : null, host)} className="h-10 px-4 rounded-xl bg-[#0F766E] text-[#FBFAF7] font-label-md text-label-md flex items-center">Get a token</Link>
          ) : (
            tel && <a href={tel} className="h-10 px-4 rounded-xl bg-[#0F766E] text-[#FBFAF7] font-label-md text-label-md flex items-center">Call</a>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-10 md:py-14 flex flex-col gap-14">
        {/* Hero */}
        <section className="flex flex-col gap-5 max-w-3xl">
          {clinic.city && <p className="font-label-sm text-label-sm uppercase tracking-[0.14em] text-[#0F766E]">{clinic.city}</p>}
          <h1 className="text-[40px] leading-[46px] md:text-[56px] md:leading-[62px] font-medium tracking-[-0.015em]" style={serif}>{clinic.clinic_name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {clinic.verified && <VerifiedBadge size="md" />}
            {clinic.is_open_24x7 && (
              <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-label-sm text-label-sm font-semibold flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                Open 24/7 (All the time)
              </span>
            )}
          </div>
          {clinic.tagline && <p className="text-[22px] leading-[32px] italic text-[#1E293B]/75" style={serif}>{clinic.tagline}</p>}
          {clinic.about && <p className="font-body-lg text-body-lg text-[#1E293B]/80">{clinic.about}</p>}
          {clinic.highlights.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {clinic.highlights.map((h) => (
                <li key={h} className="px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#F59E0B]/50 text-[#684000] font-label-sm text-label-sm">{h}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            {canBook && (
              <Link href={tokenHref(clinic, doctors.length === 1 ? doctors[0] : null, host)} className={btn}>
                <span className="material-symbols-outlined text-[20px]">confirmation_number</span> Get my token
              </Link>
            )}
            {tel && <a href={tel} className={ghost}><span className="material-symbols-outlined text-[20px]">call</span> Call {clinic.public_phone}</a>}
            {emTel && (
              <a href={emTel} className="h-12 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-label-lg text-label-lg flex items-center gap-2 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[20px]">emergency</span> 24/7 Helpline: {clinic.emergency_phone}
              </a>
            )}
            {maps && <a href={maps} target="_blank" rel="noreferrer" className={ghost}><span className="material-symbols-outlined text-[20px]">near_me</span> Directions</a>}
          </div>
        </section>

        {/* Doctors */}
        {doctors.length > 0 && (
          <section className="flex flex-col gap-6">
            <h2 className="text-[30px] leading-[38px] font-medium" style={serif}>{doctors.length === 1 ? 'Your doctor' : 'Our doctors'}</h2>
            <div className="flex flex-col gap-5">
              {doctors.map((d) => <DoctorCard key={d.id} d={d} href={canBook ? tokenHref(clinic, d, host) : null} />)}
            </div>
          </section>
        )}

        {/* Why */}
        <section className="flex flex-col gap-6">
          <h2 className="text-[30px] leading-[38px] font-medium" style={serif}>{canBook ? 'How a token helps you' : 'Before you visit'}</h2>
          <ol className="grid md:grid-cols-2 gap-x-10 gap-y-6">
            {(canBook ? WHY : VISIT_TIPS).map((w, i) => (
              <li key={w.title} className="flex gap-4 border-t border-[#1E293B]/10 pt-5">
                <span className="text-[#0F766E] text-[28px] leading-none w-8 shrink-0" style={serif}>{i + 1}</span>
                <div>
                  <p className="font-title-lg text-title-lg font-semibold">{w.title}</p>
                  <p className="font-body-md text-body-md text-[#1E293B]/75 mt-1">{w.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Location & hours */}
        {(place || doctors.some((d) => d.hours)) && (
          <section className={`${card} p-6 md:p-8 grid md:grid-cols-2 gap-8`}>
            <div className="flex flex-col gap-3">
              <h2 className="text-[26px] leading-[34px] font-medium" style={serif}>Find us</h2>
              <p className="font-body-lg text-body-lg font-semibold">{clinic.clinic_name}</p>
              {place && <p className="font-body-md text-body-md text-[#1E293B]/75">{place}</p>}
              <div className="flex flex-wrap gap-3 mt-1">
                {maps && <a href={maps} target="_blank" rel="noreferrer" className={ghost}>Open in Google Maps</a>}
                {tel && <a href={tel} className={ghost}>Call the clinic</a>}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-[26px] leading-[34px] font-medium" style={serif}>Consulting hours</h2>
              {doctors.filter((d) => d.hours).map((d) => (
                <div key={d.id}>
                  {doctors.length > 1 && <p className="font-label-md text-label-md text-[#0F766E]">{d.name}</p>}
                  <p className="font-body-md text-body-md">{d.hours}</p>
                </div>
              ))}
              {!doctors.some((d) => d.hours) && <p className="font-body-md text-body-md text-[#1E293B]/60">Hours are shown here once the doctor sets them.</p>}
            </div>
          </section>
        )}

        {/* Closing call to action */}
        {canBook ? (
          <section className="rounded-3xl bg-[#0F766E] text-[#FBFAF7] p-8 md:p-12 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <h2 className="text-[32px] leading-[40px] font-medium" style={serif}>Skip the line, not the care.</h2>
              <p className="mt-2 text-[#A3FAEF] font-body-md text-body-md">Take your token now and come when your turn is near.</p>
            </div>
            <Link href={tokenHref(clinic, doctors.length === 1 ? doctors[0] : null, host)} className="h-12 px-6 rounded-xl bg-[#FBFAF7] text-[#0F766E] font-label-lg text-label-lg flex items-center justify-center gap-2">
              Get my token <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
          </section>
        ) : (
          <ClaimBox code={clinic.subdomain} />
        )}
      </div>

      {/* Decision 75: patient reviews at the bottom of the clinic page. */}
      <div className="max-w-5xl mx-auto px-5 pb-12">
        <ClinicReviews code={clinic.subdomain} doctors={clinic.doctors.map((d) => ({ id: d.id, name: d.name }))} />
      </div>

      <PublicFooter clinicCode={clinic.subdomain} />
    </main>
  );
}

function DoctorCard({ d, href }: { d: DirectoryLandingDoctor; href: string | null }) {
  return (
    <article className={`${card} p-5 md:p-7 flex flex-col md:flex-row gap-6`}>
      {d.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(d.photo_url)} alt={d.name} className="w-32 h-32 md:w-40 md:h-40 rounded-3xl object-cover shrink-0" />
      ) : (
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-[#9CF2E8] text-[#005C55] text-[44px] flex items-center justify-center shrink-0" style={serif}>{initials(d.name)}</div>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div>
          <h3 className="text-[28px] leading-[36px] font-medium" style={serif}>{d.name}</h3>
          <p className="font-body-md text-body-md text-[#1E293B]/75">{[d.qualification, d.specialty].filter(Boolean).join(' · ')}</p>
        </div>
        {d.experience_years ? <span className="self-start px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#F59E0B]/50 text-[#684000] font-label-sm text-label-sm">{d.experience_years} years in practice</span> : null}
        {d.bio && <p className="font-body-md text-body-md text-[#1E293B]/80">{d.bio}</p>}
        {(d.fee_inr || d.hours) && (
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 border-t border-[#1E293B]/10 pt-3">
            {d.fee_inr ? <div><dt className="font-label-sm text-label-sm uppercase tracking-wider text-[#1E293B]/55">Consultation fee</dt><dd className="font-body-md text-body-md font-semibold">₹{d.fee_inr.toLocaleString('en-IN')}</dd></div> : null}
            {d.hours ? <div><dt className="font-label-sm text-label-sm uppercase tracking-wider text-[#1E293B]/55">Hours</dt><dd className="font-body-md text-body-md">{d.hours}</dd></div> : null}
          </dl>
        )}
        {href && <Link href={href} className={`${btn} self-start`}>Get a token with {d.name.replace(/^dr\.?\s+/i, 'Dr. ')}</Link>}
      </div>
    </article>
  );
}
