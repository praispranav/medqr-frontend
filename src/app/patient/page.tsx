'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, patientDevice } from '@/lib/api';
import { Icon, PatientHeader, LoadingPage } from '@/components/patient/ui';
import { useT, dateLocale } from '@/lib/i18n';

// patient.clinicq.in home — the one shared landing/account page for every clinic's patients, reached
// by visiting the subdomain with no clinic in the path (the middleware rewrites "/" here to "/patient").
// Scanning a clinic's QR still goes straight into /patient/<subdomain>/... exactly as before; this page
// is only for someone who already has a phone-verified ClinicQ history and wants to:
//   - regain a token they lost track of (closed the tab, new phone, cleared storage), or
//   - see which doctors they've visited and jump straight back into booking with one of them.
// Shared component, so useT() takes no default language (Decision 35).

export default function PatientHomePage() {
  const { t, lang } = useT();
  const locale = dateLocale(lang);
  const [mobile, setMobile] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [verified, setVerified] = useState(!!patientDevice.get());
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.myTokens>> | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  useEffect(() => {
    if (!verified) return;
    api
      .myTokens()
      .then(setSummary)
      .catch(() => setSummary({ live: [], visited: [] }));
  }, [verified]);

  const send = async () => {
    const digits = mobile.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError(t('ph_mobile_invalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.sendOtp(digits);
      setSentTo(digits);
      setDevCode(r.dev_code ?? null);
      setResendIn(r.expires_in_seconds > 30 ? 30 : r.expires_in_seconds);
      setTimeout(() => codeRef.current?.focus(), 50);
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
      patientDevice.set(r.patient_token, r.mobile_number);
      setVerified(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('otp_verify_failed'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const changeNumber = () => {
    patientDevice.clear();
    setVerified(false);
    setSummary(null);
    setSentTo(null);
    setCode('');
    setMobile('');
  };

  return (
    <main className="min-h-screen bg-surface pb-16">
      <PatientHeader eyebrow="ClinicQ" title={t('ph_title')} />
      <div className="max-w-[480px] mx-auto w-full px-margin pt-24 flex flex-col gap-5">
        {!verified ? (
          <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div>
              <h1 className="font-headline-sm text-headline-sm text-on-surface">{t('ph_title')}</h1>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">{t('ph_subtitle')}</p>
            </div>

            {!sentTo ? (
              <>
                <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-4 h-14 focus-within:ring-2 focus-within:ring-primary/30">
                  <span className="font-body-lg text-body-lg text-on-surface-variant">+91</span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder={t('mobile_number')}
                    className="flex-1 min-w-0 bg-transparent font-headline-sm text-headline-sm focus:outline-none"
                  />
                </div>
                <button
                  disabled={busy || mobile.length !== 10}
                  onClick={send}
                  className="h-14 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {busy ? t('otp_sending') : t('otp_send')}
                </button>
              </>
            ) : (
              <>
                <p className="font-body-md text-body-md text-on-surface-variant">{t('otp_sent_to', { number: sentTo })}</p>
                {devCode && (
                  <p className="font-body-sm text-body-sm text-secondary">
                    {t('otp_test_mode')} <strong>{devCode}</strong>
                  </p>
                )}
                <input
                  ref={codeRef}
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(v);
                    if (v.length === 6) verify(v);
                  }}
                  placeholder="••••••"
                  className="h-14 bg-surface-container-low rounded-xl px-4 text-center font-headline-sm text-headline-sm tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  disabled={busy || code.length !== 6}
                  onClick={() => verify(code)}
                  className="h-14 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {busy ? t('otp_checking') : t('otp_verify')}
                </button>
                <button
                  disabled={resendIn > 0 || busy}
                  onClick={send}
                  className="font-label-md text-label-md text-primary disabled:text-outline self-center"
                >
                  {resendIn > 0 ? t('otp_resend_in', { s: resendIn }) : t('otp_resend')}
                </button>
              </>
            )}
            {error && (
              <p className="font-body-sm text-body-sm text-error flex items-center gap-1.5">
                <Icon name="error" className="text-[16px]" /> {error}
              </p>
            )}
          </section>
        ) : !summary ? (
          <LoadingPage />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="font-body-sm text-body-sm text-on-surface-variant">{patientDevice.get()?.mobile}</p>
              <button onClick={changeNumber} className="font-label-md text-label-md text-primary">
                {t('ph_change_number')}
              </button>
            </div>

            <section>
              <h2 className="font-label-lg text-label-lg text-on-surface-variant mb-2">{t('ph_live_tokens')}</h2>
              {summary.live.length === 0 ? (
                <p className="font-body-md text-body-md text-on-surface-variant bg-surface-container-lowest rounded-2xl p-4">{t('ph_no_live_tokens')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {summary.live.map((tok) => (
                    <Link
                      key={tok.token_id}
                      href={`/patient/${tok.clinic_subdomain}/queue/${tok.token_id}`}
                      className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-3"
                    >
                      <span className="font-headline-sm text-headline-sm text-primary w-12 shrink-0">#{tok.token_number}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-label-lg text-label-lg truncate">{tok.doctor_name}</span>
                        <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
                          {tok.clinic_name}
                          {tok.patient_name ? ` · ${tok.patient_name}` : ''}
                        </span>
                      </span>
                      <Icon name="chevron_right" className="text-on-surface-variant text-[20px]" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="font-label-lg text-label-lg text-on-surface-variant mb-2">{t('ph_visited')}</h2>
              {summary.visited.length === 0 ? (
                <p className="font-body-md text-body-md text-on-surface-variant bg-surface-container-lowest rounded-2xl p-4">{t('ph_no_visited')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {summary.visited.map((v) => (
                    <div key={v.doctor_id} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-3">
                      <span className="flex-1 min-w-0">
                        <span className="block font-label-lg text-label-lg truncate">{v.doctor_name}</span>
                        <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
                          {[v.specialty, v.clinic_name].filter(Boolean).join(' · ')}
                        </span>
                        <span className="block font-body-sm text-body-sm text-on-surface-variant">
                          {t('ph_last_visit', { date: new Date(`${v.last_visit_date}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}
                        </span>
                      </span>
                      <Link
                        href={`/patient/${v.clinic_subdomain}/intake?doctorId=${v.doctor_id}`}
                        className="shrink-0 h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center gap-1.5"
                      >
                        {t('ph_book_again')}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="font-body-sm text-body-sm text-on-surface-variant text-center flex items-center justify-center gap-1.5">
              <Icon name="qr_code_scanner" className="text-[16px]" /> {t('ph_scan_instead')}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
