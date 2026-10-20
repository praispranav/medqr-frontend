import { PublicFooter } from '@/components/public/PublicFooter';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { fileUrl, type DirectoryLandingDoctor } from '@/lib/api';
import { WHY, VISIT_TIPS, directionsUrl, initials, orderedDoctors, telHref, tokenHref, type LandingProps } from './landingData';
import { ClaimBox } from './ClaimBox';
import { ClinicReviews } from './ClinicReviews';
import { VerifiedBadge } from '@/components/directory/VerifiedBadge';

// Template 2 — "Playful": bright, rounded, pastel-tinted tiles and friendly icons. Same content as the editorial
// template, a lighter and more energetic look. Green is the brand colour here (no blue / indigo); amber and peach
// are only soft accents.

const TILE_TONES = ['bg-[#DCFCE7]', 'bg-[#FFEDD5]', 'bg-[#CCFBF1]', 'bg-[#ECFCCB]'];
const btn = 'h-12 px-6 rounded-full bg-[#0F766E] hover:bg-[#115E59] text-white font-label-lg text-label-lg flex items-center justify-center gap-2 transition-colors';

export function PlayfulLanding({ clinic, focusSlug, staffLoginHref, host }: LandingProps) {
  const doctors = orderedDoctors(clinic, focusSlug);
  const maps = directionsUrl(clinic);
  const tel = telHref(clinic.public_phone);
  const emTel = telHref(clinic.emergency_phone ?? null);
  const place = [clinic.address, clinic.city].filter(Boolean).join(', ');
  const mainHref = tokenHref(clinic, doctors.length === 1 ? doctors[0] : null, host);
  const canBook = clinic.booking_open !== false; // Decision 60: only opted-in clinics take online tokens

  return (
    <main className="min-h-screen bg-[#F4FBF6] text-[#0F2A24]">
      <header className="bg-white/80 backdrop-blur border-b border-[#0F766E]/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center gap-3">
          <BrandLogo />
          {!staffLoginHref && <Link href="/doctors" className="ml-auto text-[#0F2A24]/65 font-label-md text-label-md">All doctors</Link>}
          {staffLoginHref && <Link href={staffLoginHref} className="ml-auto h-10 px-4 rounded-full border border-[#0F766E]/25 text-[#0F766E] font-label-md text-label-md flex items-center">Login</Link>}
          {canBook ? (
            <Link href={mainHref} className="h-10 px-4 rounded-full bg-[#0F766E] text-white font-label-md text-label-md flex items-center">Get a token</Link>
          ) : (
            tel && <a href={tel} className="h-10 px-4 rounded-full bg-[#0F766E] text-white font-label-md text-label-md flex items-center">Call</a>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8 flex flex-col gap-8">
        {/* Hero */}
        <section className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgba(15,118,110,0.08)] p-6 md:p-10 flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 flex flex-col gap-4">
            {clinic.city && <span className="self-start px-3 py-1 rounded-full bg-[#CCFBF1] text-[#0F766E] font-label-sm text-label-sm flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">location_on</span>{clinic.city}</span>}
            <h1 className="font-headline-lg text-[34px] leading-[40px] md:text-[46px] md:leading-[52px] font-extrabold tracking-tight">{clinic.clinic_name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {clinic.verified && <div><VerifiedBadge size="md" /></div>}
              {clinic.is_open_24x7 && (
                <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-label-sm text-label-sm font-semibold flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Open 24/7 (All the time)
                </span>
              )}
            </div>
            {clinic.tagline && <p className="font-body-lg text-body-lg text-[#0F2A24]/75">{clinic.tagline}</p>}
            {clinic.about && <p className="font-body-md text-body-md text-[#0F2A24]/70">{clinic.about}</p>}
            {clinic.highlights.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {clinic.highlights.map((h, i) => (
                  <li key={h} className={`px-3 py-1.5 rounded-full ${TILE_TONES[i % TILE_TONES.length]} font-label-sm text-label-sm`}>{h}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="w-28 h-28 md:w-40 md:h-40 rounded-[2rem] bg-[#DCFCE7] flex items-center justify-center shrink-0 self-center md:self-start">
            <span className="material-symbols-outlined text-[#0F766E] !text-[64px] md:!text-[88px]">health_and_safety</span>
          </div>
        </section>

        {/* Action tiles */}
        <section className="grid md:grid-cols-3 gap-4">
          {maps ? (
            <a href={maps} target="_blank" rel="noreferrer" className="rounded-[1.75rem] bg-[#DCFCE7] p-5 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <span className="material-symbols-outlined text-[#0F766E] !text-[32px]">near_me</span>
              <p className="font-title-lg text-title-lg font-bold">Directions</p>
              <p className="font-body-sm text-body-sm text-[#0F2A24]/70">{place || 'Open in Google Maps'}</p>
            </a>
          ) : <div className="rounded-[1.75rem] bg-[#DCFCE7] p-5"><p className="font-title-lg font-bold">Visit us</p><p className="font-body-sm text-[#0F2A24]/70">{clinic.city ?? ''}</p></div>}
          {tel ? (
            <a href={tel} className="rounded-[1.75rem] bg-[#FFEDD5] p-5 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <span className="material-symbols-outlined text-[#9A4B00] !text-[32px]">call</span>
              <p className="font-title-lg text-title-lg font-bold">Call the clinic</p>
              <p className="font-body-sm text-body-sm text-[#0F2A24]/70">{clinic.public_phone}</p>
            </a>
          ) : <div className="rounded-[1.75rem] bg-[#FFEDD5] p-5"><p className="font-title-lg font-bold">Need help?</p><p className="font-body-sm text-[#0F2A24]/70">Ask at the reception desk.</p></div>}
          {emTel && (
            <a href={emTel} className="rounded-[1.75rem] bg-rose-100 border border-rose-200 p-5 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <span className="material-symbols-outlined text-rose-700 !text-[32px]">emergency</span>
              <p className="font-title-lg text-title-lg font-bold text-rose-950">24/7 Helpline</p>
              <p className="font-body-sm text-body-sm text-rose-800">{clinic.emergency_phone}</p>
            </a>
          )}
          {canBook ? (
            <Link href={mainHref} className="rounded-[1.75rem] bg-[#0F766E] text-white p-5 flex flex-col gap-2 hover:bg-[#115E59] transition-colors">
              <span className="material-symbols-outlined !text-[32px]">confirmation_number</span>
              <p className="font-title-lg text-title-lg font-bold">Get a token</p>
              <p className="font-body-sm text-body-sm text-white/85">Take your place in line from your phone.</p>
            </Link>
          ) : (
            <div className="rounded-[1.75rem] bg-white p-5 flex flex-col gap-2">
              <span className="material-symbols-outlined text-[#0F2A24]/50 !text-[32px]">schedule</span>
              <p className="font-title-lg text-title-lg font-bold">Walk-in</p>
              <p className="font-body-sm text-body-sm text-[#0F2A24]/70">Online tokens aren&apos;t available for this clinic yet.</p>
            </div>
          )}
        </section>

        {/* Doctors */}
        {doctors.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-headline-md text-headline-md font-extrabold">{doctors.length === 1 ? 'Meet your doctor' : 'Meet our doctors'}</h2>
            {doctors.map((d) => <DoctorCard key={d.id} d={d} href={canBook ? tokenHref(clinic, d, host) : null} />)}
          </section>
        )}

        {/* Why */}
        <section className="flex flex-col gap-4">
          <h2 className="font-headline-md text-headline-md font-extrabold">{canBook ? 'Why patients like tokens' : 'Before you visit'}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(canBook ? WHY : VISIT_TIPS).map((w, i) => (
              <div key={w.title} className={`rounded-[1.75rem] ${TILE_TONES[i % TILE_TONES.length]} p-5 flex flex-col gap-2`}>
                <span className="w-11 h-11 rounded-2xl bg-white/70 flex items-center justify-center material-symbols-outlined text-[#0F766E] !text-[26px]">{w.icon}</span>
                <p className="font-title-lg text-title-lg font-bold">{w.title}</p>
                <p className="font-body-sm text-body-sm text-[#0F2A24]/75">{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Location & hours */}
        {(place || clinic.is_open_24x7 || clinic.operating_hours || doctors.some((d) => d.hours)) && (
          <section className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgba(15,118,110,0.08)] p-6 md:p-8 grid md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="font-headline-sm text-headline-sm font-extrabold">Find us</h2>
              <p className="font-body-md text-body-md font-semibold">{clinic.clinic_name}</p>
              {place && <p className="font-body-md text-body-md text-[#0F2A24]/70">{place}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                {maps && <a href={maps} target="_blank" rel="noreferrer" className="h-10 px-4 rounded-full bg-[#DCFCE7] text-[#0F766E] font-label-md text-label-md flex items-center">Open in Google Maps</a>}
                {tel && <a href={tel} className="h-10 px-4 rounded-full bg-[#FFEDD5] text-[#9A4B00] font-label-md text-label-md flex items-center">Call front desk</a>}
                {emTel && (
                  <a href={emTel} className="h-10 px-4 rounded-full bg-rose-100 text-rose-800 font-label-md text-label-md flex items-center gap-1 font-semibold">
                    <span className="material-symbols-outlined text-[18px]">emergency</span> 24/7 Helpline
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-headline-sm text-headline-sm font-extrabold">Hours &amp; consultations</h2>
              {clinic.is_open_24x7 ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <p className="font-label-sm text-label-sm text-emerald-800 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" /> Facility Hours
                  </p>
                  <p className="font-body-md text-body-md text-emerald-950 font-bold">Open 24 Hours / 7 Days a week (All the time)</p>
                </div>
              ) : clinic.operating_hours ? (
                <div className="rounded-2xl bg-[#F4FBF6] px-4 py-3">
                  <p className="font-label-sm text-label-sm text-[#0F766E] font-semibold">Facility Hours</p>
                  <p className="font-body-md text-body-md">{clinic.operating_hours}</p>
                </div>
              ) : null}
              {doctors.filter((d) => d.hours).map((d) => (
                <div key={d.id} className="rounded-2xl bg-[#F4FBF6] px-4 py-3">
                  {doctors.length > 1 && <p className="font-label-sm text-label-sm text-[#0F766E]">{d.name}</p>}
                  <p className="font-body-md text-body-md">{d.hours}</p>
                </div>
              ))}
              {!clinic.is_open_24x7 && !clinic.operating_hours && !doctors.some((d) => d.hours) && (
                <p className="font-body-md text-body-md text-[#0F2A24]/60">Hours appear here once the doctor sets them.</p>
              )}
            </div>
          </section>
        )}

        {/* Closing call to action */}
        {canBook ? (
          <section className="rounded-[2rem] bg-[#DCFCE7] p-8 md:p-12 text-center flex flex-col items-center gap-4">
            <h2 className="font-headline-lg text-[32px] leading-[38px] md:text-[40px] md:leading-[46px] font-extrabold text-[#0F766E]">Skip the line, not the care.</h2>
            <p className="font-body-lg text-body-lg text-[#0F2A24]/70 max-w-md">Take your token now and arrive when your turn is near. It only takes a few seconds.</p>
            <Link href={mainHref} className={btn}>Get my token <span className="material-symbols-outlined text-[20px]">arrow_forward</span></Link>
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
    <article className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgba(15,118,110,0.08)] p-5 md:p-7 flex flex-col sm:flex-row gap-5">
      {d.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(d.photo_url)} alt={d.name} className="w-28 h-28 rounded-full object-cover ring-4 ring-[#CCFBF1] shrink-0" />
      ) : (
        <div className="w-28 h-28 rounded-full bg-[#CCFBF1] text-[#0F766E] font-extrabold text-[34px] flex items-center justify-center ring-4 ring-[#DCFCE7] shrink-0">{initials(d.name)}</div>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {d.specialty && <span className="px-3 py-1 rounded-full bg-[#DCFCE7] text-[#0F766E] font-label-sm text-label-sm">{d.specialty}</span>}
          {d.experience_years ? <span className="px-3 py-1 rounded-full bg-[#FFEDD5] text-[#9A4B00] font-label-sm text-label-sm">{d.experience_years} years in practice</span> : null}
        </div>
        <div>
          <h3 className="font-headline-md text-headline-md font-extrabold">{d.name}</h3>
          {d.qualification && <p className="font-body-md text-body-md text-[#0F2A24]/65">{d.qualification}</p>}
        </div>
        {d.bio && <p className="font-body-md text-body-md text-[#0F2A24]/75">{d.bio}</p>}
        {(d.fee_inr || d.hours) && (
          <div className="flex flex-wrap gap-3">
            {d.fee_inr ? <div className="rounded-2xl bg-[#F4FBF6] px-4 py-2"><p className="font-label-sm text-label-sm text-[#0F2A24]/55">Consultation fee</p><p className="font-body-md text-body-md font-bold">₹{d.fee_inr.toLocaleString('en-IN')}</p></div> : null}
            {d.hours ? <div className="rounded-2xl bg-[#F4FBF6] px-4 py-2"><p className="font-label-sm text-label-sm text-[#0F2A24]/55">Hours</p><p className="font-body-md text-body-md font-bold">{d.hours}</p></div> : null}
          </div>
        )}
        {href && <Link href={href} className={`${btn} self-start`}>Book with {d.name.replace(/^dr\.?\s+/i, 'Dr. ')}</Link>}
      </div>
    </article>
  );
}
