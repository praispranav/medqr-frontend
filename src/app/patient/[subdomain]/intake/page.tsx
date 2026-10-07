'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, patientDevice, type DoctorToday, type NextSession, type Patient, type Tenant } from '@/lib/api';
import { DoctorAvatar, FullPageMessage, Icon, initials, LanguageButton, LoadingPage, nextSessionLabel } from '@/components/patient/ui';
import { dateLocale, localizeStatusDetail, useT } from '@/lib/i18n';
import { doctorSettings } from '@/lib/doctorSettings';
import { CustomIntakeForm } from '@/components/patient/CustomIntakeForm';
import { clinicToday } from '@/lib/clinicTime';

// Screen #1 (returning 1-tap / new patient) + Screen #2 (intake details), on one page. Ported from
// stitch_medqr_clinic_suite_ui_design/patient_qr_landing_check_in/code.html and
// stitch_medqr_clinic_suite_ui_design/patient_intake_form/code.html.
// Only name + mobile are required; everything else is optional (CLAUDE.md §4).
// WhatsApp OTP (Telnyx) is OFF by default for fast check-in; the doctor (Queue Rules) or platform
// admin can require it per clinic. Either way the phone remembers the patient for 90 days (1-tap next
// time). Unverified phones only ever see the profiles they created themselves. Dropped from the
// designs because nothing backs them yet: alternate number, kg/lb toggle, "Token #46" preview,
// encryption/prototype banners. Patient uploads are tagged uploaded_by 'patient' (Decision 4).

const SYMPTOMS = [
  { key: 'in_sym_fever', emoji: '🌡️' },
  { key: 'in_sym_followup', emoji: '📋' },
  { key: 'in_sym_cold', emoji: '🤧' },
  { key: 'in_sym_stomach', emoji: '💊' },
] as const;

// Decision 17 — human-readable label for a bookingDate (YYYY-MM-DD) query param, in the patient's language.
const formatBookingDate = (iso: string, opts: Intl.DateTimeFormatOptions, locale = 'en-IN') =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(locale, opts);

export default function IntakePage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <IntakeForm />
    </Suspense>
  );
}

function IntakeForm() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const params = useSearchParams();
  const doctorId = params.get('doctorId');
  // Decision 17 — set only when this visit was booked from the advance-booking date strip.
  const bookingDate = params.get('date');
  const router = useRouter();
  // Back / Home always land on Doctor Selection (which also lists this phone's tokens). Not
  // router.back(): a patient who arrived straight from a doctor's QR has no history to go back to.
  const doctorsPage = `/patient/${subdomain}/select-doctor`;
  const goBack = () => router.push(doctorsPage);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [doctor, setDoctor] = useState<DoctorToday | null>(null);
  const [loadError, setLoadError] = useState(false);
  // A doctor's own QR opens this page directly (no doctor selection) — so check today's status here (Decision 6).
  const [offToday, setOffToday] = useState<{ name: string; detail: string; next: NextSession | null } | null>(null);
  // Decision 35: the page opens in the language this doctor chose (else the clinic's); the patient's own 🌐 choice wins.
  const [doctorLang, setDoctorLang] = useState<string | undefined>(undefined);
  const { t, lang } = useT(doctorLang);
  const locale = dateLocale(lang);

  // Identity — returning profiles (1-tap) or a new person
  const [profiles, setProfiles] = useState<Patient[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [mode, setMode] = useState<'returning' | 'new'>('new');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState('');
  const [remember, setRemember] = useState(true);
  const [phoneState, setPhoneState] = useState<'checking' | 'needed' | 'ready'>('checking');
  const [otpRequired, setOtpRequired] = useState(false);
  const [verified, setVerified] = useState(false);
  const [whatsappUpdates, setWhatsappUpdates] = useState(true);

  // Visit details — all optional
  const [complaint, setComplaint] = useState('');
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, any>>({});
  const [weight, setWeight] = useState('');
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [errors, setErrors] = useState<{ name?: boolean; mobile?: boolean }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [advanceDays, setAdvanceDays] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const clinic = await api.getTenantBySubdomain(subdomain);
        if (!clinic) return setLoadError(true);

        const advance = await api.getAdvanceBooking(clinic.id).catch(() => ({ days: [] }));
        setAdvanceDays(advance.days);

        let d: DoctorToday | undefined;
        if (bookingDate) {
          // Decision 17 — a future booking: today's off/on-break status is irrelevant, only whether
          // the doctor actually has a session on that date (re-checked server-side at join too).
          const day = advance.days.find((x: any) => x.date === bookingDate);
          const match = day?.doctors.find((x: any) => x.id === doctorId);
          if (!match) return setLoadError(true);
          d = { ...match, today_status: 'available', today_status_detail: '' } as DoctorToday;
          setDoctorLang(doctorSettings(clinic, d).patient_language);
        } else {
          const doctors = await api.getDoctorsToday(clinic.id);
          d = doctors.find((x) => x.id === doctorId);
          if (!d) return setLoadError(true);
          setDoctorLang(doctorSettings(clinic, d).patient_language);
          // A doctor's own QR lands here directly, so check today's status (Decision 6).
          if (d.today_status === 'off_today') {
            return setOffToday({
              name: d.name,
              detail: d.today_status_detail, // translated at render (localizeStatusDetail)
              next: d.next_session ?? null,
            });
          }
        }
        setTenant(clinic);
        setDoctor(d);

        const rules = await api.checkInRules(clinic.id).catch(() => ({ require_whatsapp_otp: false }));
        setOtpRequired(rules.require_whatsapp_otp);
        await loadDeviceProfiles(rules.require_whatsapp_otp);
      } catch {
        setLoadError(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdomain, doctorId, bookingDate]);

  /** Saved check-in on this phone → 1-tap. Ask for WhatsApp OTP only if the clinic requires it. */
  async function loadDeviceProfiles(required: boolean) {
    if (!patientDevice.get()) {
      setVerified(false);
      setMode('new');
      return setPhoneState(required ? 'needed' : 'ready');
    }
    try {
      const me = await api.myProfiles();
      if (required && !me.verified) {
        setMobile(me.mobile_number);
        return setPhoneState('needed');
      }
      setVerified(me.verified);
      setMobile(me.mobile_number);
      if (me.profiles.length > 0) {
        const self = me.profiles.find((p) => p.relation === 'self') ?? me.profiles[0];
        setProfiles(me.profiles);
        setSelectedProfileId(self.id);
        setMode('returning');
      } else {
        setProfiles([]);
        setMode('new');
      }
      setPhoneState('ready');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) patientDevice.clear();
      setMode('new');
      setPhoneState(required ? 'needed' : 'ready');
    }
  }

  if (loadError)
    return (
      <FullPageMessage
        icon="error"
        title="Couldn't start check-in"
        body="Please go back and choose your doctor again, or ask the reception desk."
      />
    );
  if (offToday)
    return (
      // Never a dead end: Home always, and "Book for <next session>" when it's inside the doctor's booking window.
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-3 bg-surface relative">
        <LanguageButton className="absolute top-3 right-3" />
        <div className="w-14 h-14 rounded-full bg-surface-container-low text-primary flex items-center justify-center">
          <Icon name="event_busy" className="text-[28px]" />
        </div>
        <h1 className="font-headline-md text-headline-md text-on-surface">{t('in_off_title', { name: offToday.name })}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
          {offToday.next ? t('in_off_next', { when: nextSessionLabel(offToday.next, locale) }) : localizeStatusDetail(offToday.detail, t)}
          {offToday.next?.bookable ? '' : ` ${t('in_off_body')}`}
        </p>
        <div className="w-full max-w-xs flex flex-col gap-2 mt-3">
          {offToday.next?.bookable && (
            <Link
              href={`/patient/${subdomain}/intake?doctorId=${doctorId}&date=${offToday.next.date}`}
              className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2"
            >
              <Icon name="event_available" className="text-[20px]" /> {t('in_book_for', { when: nextSessionLabel(offToday.next, locale) })}
            </Link>
          )}
          <Link href={doctorsPage} className="h-12 bg-surface-container-high text-on-surface rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2">
            <Icon name="home" className="text-[20px]" /> {t('in_choose_other')}
          </Link>
        </div>
      </main>
    );
  if (!tenant || !doctor || phoneState === 'checking') return <LoadingPage />;
  if (phoneState === 'needed') {
    return (
      <VerifyPhone
        clinicName={tenant.display_name ?? subdomain}
        doctorName={doctor.name}
        onBack={goBack}
        onVerified={async (token, verifiedMobile) => {
          patientDevice.set(token, verifiedMobile);
          setPhoneState('checking');
          await loadDeviceProfiles(otpRequired);
        }}
      />
    );
  }

  const clinicName = tenant.display_name ?? subdomain;
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;
  const mobileDigits = mobile.replace(/\D/g, '').slice(-10);

  const toggleSymptom = (label: string) => {
    const parts = complaint.split(',').map((s) => s.trim()).filter(Boolean);
    const next = parts.includes(label) ? parts.filter((p) => p !== label) : [...parts, label];
    setComplaint(next.join(', '));
  };

  const startNewPerson = (keepMobile: boolean) => {
    setMode('new');
    setSelectedProfileId(null);
    setName('');
    setAge(null);
    setGender('');
    if (!keepMobile) {
      // Different number: forget this phone's saved check-in (and verify the new one if the clinic requires OTP).
      patientDevice.clear();
      setVerified(false);
      setMobile('');
      setProfiles([]);
      setPhoneState(otpRequired ? 'needed' : 'ready');
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    let patientId: string;
    try {
      if (mode === 'returning' && selectedProfile) {
        patientId = selectedProfile.id;
      } else {
        const nextErrors = { name: !name.trim(), mobile: mobileDigits.length !== 10 };
        setErrors(nextErrors);
        if (nextErrors.name || nextErrors.mobile) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        setSubmitting(true);
        const patient = await api.findOrCreatePatient({
          tenantId: tenant.id,
          mobile_number: mobileDigits,
          name: name.trim(),
          age,
          gender: gender || null,
          whatsapp_updates: whatsappUpdates,
        });
        patientId = patient.id;
        // Remember this phone for 1-tap next time (only this profile unless the number was OTP-verified).
        if (patient.device_token) patientDevice.set(patient.device_token, mobileDigits);
      }

      setSubmitting(true);
      const token = await api.joinQueue({
        tenantId: tenant.id,
        doctorId: doctor.id,
        patientId,
        chief_complaint: complaint.trim() || null,
        intake_answers: Object.keys(intakeAnswers).length ? intakeAnswers : null,
        weight_kg: weight ? Number(weight) : null,
        bookingDate: bookingDate ?? undefined,
      });
      // Attachments never block the token — a failed attach is dropped silently.
      for (const f of files) {
        await api.addPatientAttachment(token.id, f).catch(() => undefined);
      }
      if (!remember) patientDevice.clear();
      // Decision 10: if the fee is collected before the visit and online payment is on, let the patient
      // choose "Pay online" or "Cash at counter" now. Payment never blocks the token (Decision 9).
      const pay = await api.paymentStatus(token.id).catch(() => null);
      const askNow = pay && !pay.is_paid && pay.online_available && pay.fee_inr > 0 && pay.payment_mode !== 'pay_after_consultation';
      router.replace(askNow ? `/patient/${subdomain}/payment?token=${token.id}` : `/patient/${subdomain}/queue/${token.id}`);
    } catch (err) {
      setSubmitting(false);
      setSubmitError(
        err instanceof ApiError && err.status === 409
          ? err.message
          : t('in_token_error'),
      );
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="w-full bg-surface-container-lowest px-margin pt-3 pb-3 shadow-sm pt-safe">
        <div className="max-w-[480px] mx-auto">
          <div className="flex items-center justify-between mb-2.5 gap-2">
            <button
              type="button"
              onClick={goBack}
              className="min-h-[44px] min-w-[44px] flex items-center gap-1.5 text-primary px-2 -ml-2 rounded-xl text-label-md font-label-md active:bg-primary-fixed/30 touch-manipulation"
            >
              <Icon name="arrow_back" className="text-[20px]" />
              <span>{t('in_back')}</span>
            </button>
            <Link href={doctorsPage} aria-label="Home" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-primary rounded-xl active:bg-primary-fixed/30 touch-manipulation"><Icon name="home" className="text-[22px]" /></Link>
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-low rounded-full min-w-0">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
              <span className="text-label-sm font-label-sm text-on-surface font-semibold tracking-wide truncate">{clinicName}</span>
            </div>
            <span className="text-label-sm font-label-sm bg-primary-fixed text-on-primary-fixed px-2.5 py-0.5 rounded-full font-bold flex-shrink-0">
              {t('in_step')}
            </span>
            <LanguageButton className="!w-10 !h-10 -mr-2" />
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary-container h-full w-full rounded-full" />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[480px] mx-auto">
        <section className="px-margin pt-4 pb-2">
          <div className="flex items-center gap-3 bg-surface-container-lowest rounded-2xl p-3 shadow-sm">
            <DoctorAvatar doctor={doctor} size="w-14 h-14" />
            <div className="min-w-0 flex-1">
              <p className="font-label-lg text-label-lg font-bold text-on-surface truncate">{doctor.name}</p>
              <p className="font-body-sm text-body-sm text-primary font-semibold truncate">
                {[doctor.qualification, doctor.specialty].filter(Boolean).join(' · ') || t('in_consulting_today')}
                {doctor.cabin_label ? ` · ${doctor.cabin_label}` : ''}
              </p>
            </div>
          </div>

          {(() => {
            const doctorDays = advanceDays
              .map((day) => ({
                date: day.date as string,
                doctor: day.doctors.find((d: any) => d.id === doctorId),
              }))
              .filter((x) => x.doctor);
              
            if (doctorDays.length === 0) return null;

            const todayStr = clinicToday();
            
            return (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mt-3 pb-1 -mx-margin px-margin">
                {doctorDays.map((d) => {
                  const isToday = d.date === todayStr;
                  // Hide today chip if doctor is off today (handled if they aren't in doctorDays, but just in case)
                  if (isToday && doctor.today_status === 'off_today') return null;

                  const isSelected = bookingDate ? bookingDate === d.date : isToday;
                  const disabled = d.doctor.is_full;
                  const label = isToday ? t('in_today') : formatBookingDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }, locale);
                  const subLabel = d.doctor.is_full ? t('in_full') : t('in_left', { n: d.doctor.tokens_left });

                  return (
                    <button
                      key={d.date}
                      disabled={disabled && !isSelected}
                      onClick={() => {
                        const url = new URL(window.location.href);
                        if (isToday) {
                          url.searchParams.delete('date');
                        } else {
                          url.searchParams.set('date', d.date);
                        }
                        router.replace(url.pathname + url.search);
                      }}
                      className={`shrink-0 flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-primary text-on-primary shadow-sm ring-2 ring-primary ring-offset-1 ring-offset-surface'
                          : disabled
                          ? 'bg-surface-container-low text-on-surface-variant opacity-60 cursor-not-allowed'
                          : 'bg-surface-container-lowest text-on-surface-variant shadow-sm hover:shadow'
                      }`}
                    >
                      <span className="font-label-md text-label-md font-bold">{label}</span>
                      <span className={`font-label-sm text-[11px] ${isSelected ? 'text-on-primary/80' : 'text-on-surface-variant/80'}`}>
                        {subLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          <h1 className="text-headline-sm font-headline-sm text-on-surface tracking-tight font-bold mt-3">
            {mode === 'returning' && selectedProfile ? t('in_welcome_back') : t('in_quick_details')}
          </h1>

          {(errors.name || errors.mobile) && (
            <div className="mt-3 p-3.5 bg-error-container text-on-error-container rounded-xl shadow-sm">
              <div className="flex items-start gap-2.5">
                <Icon name="warning" className="text-[20px] text-error shrink-0 mt-0.5" />
                <div>
                  <p className="text-label-md font-label-md font-bold text-error">{t('in_complete_required')}</p>
                  <p className="text-body-sm font-body-sm mt-0.5">{t('in_need_name_mobile')}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        <form
          className="px-margin flex flex-col gap-4 pt-2 pb-40"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          {mode === 'returning' ? (
            // ---- Returning patient: 1-tap profile pick (Screen #1, "Returning") ----
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-label-lg text-label-lg text-on-surface">{t('in_who_seeing')}</h3>
                <span className="font-label-sm text-label-sm text-outline">{t('in_tap_profile')}</span>
              </div>
              <div className="space-y-2.5">
                {profiles.map((p) => {
                  const active = p.id === selectedProfileId;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setSelectedProfileId(p.id)}
                      className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all ${
                        active ? 'bg-surface-container-low' : 'bg-surface-container-lowest hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary-fixed-dim text-on-primary-fixed font-headline-sm text-headline-sm flex items-center justify-center font-bold flex-shrink-0">
                          {initials(p.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-label-lg text-label-lg text-on-surface truncate">{p.name}</span>
                            {p.relation === 'self' && (
                              <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm">
                                {t('in_self')}
                              </span>
                            )}
                          </div>
                          {(p.age || p.gender) && (
                            <p className="font-body-sm text-body-sm text-on-surface-variant">
                              {[p.age ? t('in_yrs', { n: p.age }) : null, p.gender].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Icon
                        name={active ? 'check_circle' : 'radio_button_unchecked'}
                        fill={active}
                        className={`text-[24px] ${active ? 'text-primary' : 'text-outline-variant'}`}
                      />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => startNewPerson(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-surface-container-low text-primary hover:bg-surface-container flex items-center justify-center gap-2 font-label-md text-label-md transition-colors"
                >
                  <Icon name="add_circle" className="text-[18px]" />
                  <span>{t('in_add_family')}</span>
                </button>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-container text-center">
                <button type="button" onClick={() => startNewPerson(false)} className="text-primary hover:underline font-label-md text-label-md">
                  {t('in_not_you_other')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ---- New patient: name + mobile (required), age + gender (optional) ---- */}
              <div className={`p-4 rounded-2xl shadow-sm ${errors.name ? 'bg-error-container/30' : 'bg-surface-container-lowest'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon name="person" className="text-primary text-[20px]" />
                    <label className="text-label-lg font-label-lg text-on-surface font-semibold" htmlFor="patient-name">
                      {t('in_full_name')}
                    </label>
                    <span className="text-label-sm font-label-sm text-error font-bold">*</span>
                  </div>
                </div>
                <input
                  id="patient-name"
                  value={name}
                  autoComplete="name"
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((x) => ({ ...x, name: false }));
                  }}
                  placeholder={t('in_name_eg')}
                  className="w-full h-14 bg-surface-container-low rounded-xl px-4 text-headline-sm font-headline-sm text-on-surface placeholder:text-outline-variant font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </div>

              {verified ? (
                <div className="p-4 rounded-2xl shadow-sm bg-surface-container-lowest flex items-center gap-3">
                  <Icon name="verified" className="text-tertiary text-[22px]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-label-sm font-label-sm text-on-surface-variant">{t('in_mobile_verified')}</p>
                    <p className="font-headline-sm text-headline-sm text-on-surface">+91 {mobile}</p>
                  </div>
                  <button type="button" onClick={() => startNewPerson(false)} className="text-primary font-label-md text-label-md">
                    {t('in_change')}
                  </button>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl shadow-sm ${errors.mobile ? 'bg-error-container/30' : 'bg-surface-container-lowest'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="phone_android" className="text-primary text-[20px]" />
                    <label className="text-label-lg font-label-lg text-on-surface font-semibold" htmlFor="mobile">
                      {t('in_mobile')}
                    </label>
                    <span className="text-label-sm font-label-sm text-error font-bold">*</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-14 px-3 bg-surface-container-low rounded-xl flex items-center justify-center font-bold text-on-surface text-label-md shrink-0">
                      🇮🇳 +91
                    </div>
                    <input
                      id="mobile"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={11}
                      value={mobile}
                      onChange={(e) => {
                        setMobile(e.target.value.replace(/[^\d ]/g, ''));
                        setErrors((x) => ({ ...x, mobile: false }));
                      }}
                      placeholder="98765 43210"
                      className="flex-1 min-w-0 h-14 bg-surface-container-low rounded-xl px-4 text-headline-sm font-headline-sm text-on-surface placeholder:text-outline-variant font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  {errors.mobile && (
                    <p className="text-error text-body-sm font-body-sm mt-2 flex items-center gap-1">
                      <Icon name="error" className="text-[16px]" /> {t('in_mobile_invalid')}
                    </p>
                  )}
                  <label className="mt-3 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whatsappUpdates}
                      onChange={(e) => setWhatsappUpdates(e.target.checked)}
                      className="h-5 w-5 rounded accent-primary-container"
                    />
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{t('in_wa_updates')}</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm">
                  <label className="block text-label-lg font-label-lg text-on-surface font-semibold mb-2" htmlFor="age">
                    {t('in_age')}
                  </label>
                  <div className="flex items-center justify-between bg-surface-container-low p-1.5 rounded-xl">
                    <button
                      type="button"
                      aria-label="Decrease age"
                      onClick={() => setAge((a) => Math.max(0, (a ?? 30) - 1))}
                      className="w-9 h-9 rounded-lg bg-surface-container-lowest text-on-surface flex items-center justify-center shadow-sm active:scale-95"
                    >
                      <Icon name="remove" className="text-[20px]" />
                    </button>
                    <input
                      id="age"
                      inputMode="numeric"
                      value={age ?? ''}
                      placeholder="--"
                      onChange={(e) => {
                        const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                        setAge(Number.isNaN(n) ? null : Math.min(115, n));
                      }}
                      className="w-12 text-center font-headline-sm text-headline-sm font-extrabold text-on-surface bg-transparent focus:outline-none placeholder:text-outline-variant"
                    />
                    <button
                      type="button"
                      aria-label="Increase age"
                      onClick={() => setAge((a) => Math.min(115, (a ?? 29) + 1))}
                      className="w-9 h-9 rounded-lg bg-surface-container-lowest text-on-surface flex items-center justify-center shadow-sm active:scale-95"
                    >
                      <Icon name="add" className="text-[20px]" />
                    </button>
                  </div>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm">
                  <label className="block text-label-lg font-label-lg text-on-surface font-semibold mb-2" htmlFor="gender">
                    {t('in_gender')}
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-12 bg-surface-container-low rounded-xl px-3 font-body-md text-body-md text-on-surface focus:outline-none"
                  >
                    <option value="">—</option>
                    {/* Values stay English (stored on the patient); only the label is translated. */}
                    <option value="Female">{t('in_female')}</option>
                    <option value="Male">{t('in_male')}</option>
                    <option value="Other">{t('in_other')}</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <CustomIntakeForm schema={doctor.intake_schema} answers={intakeAnswers} onChange={setIntakeAnswers} />

          {/* ---- Chief complaint (optional) ---- */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon name="stethoscope" className="text-primary text-[20px]" />
                <label className="text-label-lg font-label-lg text-on-surface font-semibold" htmlFor="complaint">
                  {t('in_reason')}
                </label>
              </div>
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t('in_optional')}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {SYMPTOMS.map((s) => {
                const label = t(s.key);
                const on = complaint.split(',').map((x) => x.trim()).includes(label);
                return (
                  <button
                    type="button"
                    key={s.key}
                    onClick={() => toggleSymptom(label)}
                    aria-pressed={on}
                    className={`px-3 py-1.5 rounded-full text-label-sm font-label-sm flex items-center gap-1 active:scale-95 transition-transform ${
                      on
                        ? 'bg-primary-fixed text-on-primary-fixed font-semibold shadow-sm'
                        : 'bg-surface-container text-on-surface font-medium hover:bg-surface-container-high'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-sm">{s.emoji}</span>
                  </button>
                );
              })}
            </div>
            <textarea
              id="complaint"
              rows={3}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder={t('in_reason_ph')}
              className="w-full p-3.5 bg-surface-container-low rounded-xl text-body-md font-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
            />
          </div>

          {/* ---- Weight (optional, Decision 5 — only stored if given) ---- */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon name="scale" className="text-primary text-[20px]" />
                <label className="text-label-lg font-label-lg text-on-surface font-semibold" htmlFor="weight">
                  {t('in_weight')}
                </label>
              </div>
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t('in_optional')}</span>
            </div>
            <div className="relative flex items-center">
              <input
                id="weight"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
                placeholder={t('in_weight_eg')}
                className="w-full h-14 bg-surface-container-low rounded-xl px-4 text-headline-sm font-headline-sm text-on-surface placeholder:text-outline-variant font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="absolute right-4 text-label-md font-label-md font-bold text-on-surface-variant pointer-events-none">kg</span>
            </div>
          </div>

          {/* ---- Previous prescriptions / reports (optional) ---- */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon name="upload_file" className="text-primary text-[20px]" />
                <span className="text-label-lg font-label-lg text-on-surface font-semibold">{t('in_rx_reports')}</span>
              </div>
              <span className="text-label-sm font-label-sm text-on-surface-variant">{t('in_optional')}</span>
            </div>
            <label className="bg-surface-container-low p-4 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container transition-colors">
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  if (!picked.length) return;
                  setUploading(true);
                  setUploadError(null);
                  try {
                    for (const f of picked) {
                      const up = await api.uploadFile(f);
                      setFiles((xs) => [...xs, { url: up.url, name: up.name }]);
                    }
                  } catch (err) {
                    setUploadError(err instanceof Error ? err.message : t('in_upload_failed'));
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm mb-2">
                <Icon name={uploading ? 'progress_activity' : 'add_a_photo'} className={`text-[24px] ${uploading ? 'animate-spin' : ''}`} />
              </div>
              <p className="text-label-md font-label-md font-bold text-on-surface">
                {uploading ? t('in_uploading') : t('in_attach')}
              </p>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5">{t('in_attach_hint')}</p>
            </label>
            {uploadError && <p className="text-error text-body-sm font-body-sm mt-2">{uploadError}</p>}
            {files.map((f) => (
              <div key={f.url} className="mt-3 bg-surface-container-low p-3 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name="check_circle" className="text-tertiary text-[18px]" />
                  <span className="text-label-md font-label-md text-on-surface truncate">{f.name}</span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((xs) => xs.filter((x) => x.url !== f.url))}
                  className="w-9 h-9 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-error flex items-center justify-center shrink-0"
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
            ))}
          </div>

          <label className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded accent-primary-container"
            />
            <div>
              <p className="font-label-md text-label-md text-on-surface">{t('in_remember')}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{t('in_remember_hint')}</p>
            </div>
          </label>

          <div className="bg-error-container/40 p-3 rounded-xl flex items-start gap-2">
            <Icon name="emergency" className="text-error text-[18px] shrink-0 mt-0.5" />
            <p className="font-body-sm text-body-sm text-on-error-container leading-tight">
              <strong>{t('in_emergency_title')}</strong> {t('in_emergency_body')}
            </p>
          </div>

          {/* submit on Enter */}
          <button type="submit" className="hidden" />
        </form>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 w-full bg-surface-container-lowest/95 backdrop-blur-md px-margin pt-3 pb-safe shadow-[0_-8px_24px_rgba(19,27,46,0.06)] z-40">
        <div className="max-w-[480px] mx-auto w-full flex flex-col items-center pb-3">
          {submitError && <p className="text-error font-body-sm text-body-sm mb-2 text-center">{submitError}</p>}
          <button
            type="button"
            disabled={submitting || uploading}
            onClick={handleSubmit}
            className="w-full h-14 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all disabled:opacity-80"
          >
            {submitting ? (
              <>
                <Icon name="progress_activity" className="animate-spin text-[20px]" />
                <span>{t('in_getting_token')}</span>
              </>
            ) : (
              <>
                <span>
                  {mode === 'returning' && selectedProfile ? t('in_join_as', { name: selectedProfile.name }) : t('in_join')}
                </span>
                <Icon name="arrow_forward" className="text-[20px]" />
              </>
            )}
          </button>
          <p className="font-label-md text-label-md text-on-surface-variant mt-2 text-center">
            {doctor.name} ·{' '}
            {bookingDate
              ? t('in_booking_for_date', { date: formatBookingDate(bookingDate, { day: 'numeric', month: 'short' }, locale) })
              : localizeStatusDetail(doctor.today_status_detail, t)}
          </p>
        </div>
      </footer>
    </div>
  );
}

/** WhatsApp OTP step (Telnyx). The code arrives as a WhatsApp message with a copy-code button. */
function VerifyPhone({
  clinicName,
  doctorName,
  onBack,
  onVerified,
}: {
  clinicName: string;
  doctorName: string;
  onBack: () => void;
  onVerified: (token: string, mobile: string) => Promise<void>;
}) {
  const { subdomain } = useParams<{ subdomain: string }>();
  const { t } = useT(); // same language as the form (Decision 35)
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const digits = mobile.replace(/\D/g, '').slice(-10);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.sendOtp(digits);
      setSentTo(digits);
      setDevCode(r.dev_code ?? null);
      setCode('');
      setResendIn(30);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('otp_send_failed'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (!sentTo || value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.verifyOtp(sentTo, value);
      await onVerified(r.patient_token, r.mobile_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('otp_verify_failed'));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="w-full bg-surface-container-lowest px-margin pt-3 pb-3 shadow-sm pt-safe">
        <div className="max-w-[480px] mx-auto flex items-center justify-between gap-2">
          <button type="button" onClick={onBack} className="min-h-[44px] min-w-[44px] flex items-center gap-1.5 text-primary px-2 -ml-2 rounded-xl text-label-md font-label-md active:bg-primary-fixed/30 touch-manipulation">
            <Icon name="arrow_back" className="text-[20px]" />
            <span>{t('in_back')}</span>
          </button>
          <span className="text-label-sm font-label-sm text-on-surface font-semibold truncate">{clinicName}</span>
          <Link href={`/patient/${subdomain}/select-doctor`} aria-label="Home" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-primary rounded-xl active:bg-primary-fixed/30 touch-manipulation">
            <Icon name="home" className="text-[22px]" />
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[480px] mx-auto px-margin py-6 flex flex-col gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-on-primary-container text-primary font-label-sm text-label-sm">
            {t('otp_checking_in_with', { name: doctorName })}
          </span>
          <h1 className="font-headline-md text-headline-md text-on-surface mt-2">{sentTo ? t('otp_enter_code') : t('otp_your_number')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {sentTo ? t('otp_sent_to', { number: sentTo }) : t('otp_will_send')}
          </p>
        </div>

        {!sentTo ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-2">
              <div className="h-14 px-3 bg-surface-container-low rounded-xl flex items-center justify-center font-bold text-on-surface text-label-md shrink-0">
                🇮🇳 +91
              </div>
              <input
                autoFocus
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={11}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^\d ]/g, ''))}
                placeholder="98765 43210"
                aria-label="Mobile number"
                className="flex-1 min-w-0 h-14 bg-surface-container-low rounded-xl px-4 font-headline-sm text-headline-sm text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              disabled={busy || digits.length !== 10}
              className="h-14 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Icon name="chat" className="text-[20px]" />
              {busy ? t('otp_sending') : t('otp_send')}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verify(code);
            }}
            className="flex flex-col gap-4"
          >
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                if (v.length === 6) verify(v);
              }}
              placeholder="••••••"
              aria-label="6-digit code"
              className="h-16 text-center tracking-[0.5em] bg-surface-container-low rounded-xl font-numeric-metric text-numeric-metric text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {devCode && (
              <p className="bg-secondary-fixed/40 rounded-xl p-3 font-body-sm text-body-sm text-on-secondary-fixed-variant">
                {t('otp_test_mode')} <strong>{devCode}</strong>
              </p>
            )}
            <button disabled={busy || code.length !== 6} className="h-14 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg disabled:opacity-40">
              {busy ? t('otp_checking') : t('otp_verify')}
            </button>
            <div className="flex items-center justify-between font-label-md text-label-md">
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setError(null);
                }}
                className="text-on-surface-variant"
              >
                Change number
              </button>
              <button type="button" disabled={resendIn > 0 || busy} onClick={send} className="text-primary disabled:text-outline">
                {resendIn > 0 ? t('otp_resend_in', { s: resendIn }) : t('otp_resend')}
              </button>
            </div>
          </form>
        )}

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

        <p className="font-body-sm text-body-sm text-on-surface-variant flex items-start gap-1.5 mt-2">
          <Icon name="lock" className="text-[16px] mt-0.5" />
          We only use your number for this clinic&apos;s visit updates. No WhatsApp? Ask the reception desk to check you in.
        </p>
      </main>
    </div>
  );
}
