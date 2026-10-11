'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { api, type PatientPaymentStatus, type TokenStatusView } from '@/lib/api';
import { getQueueSocket, keepLive } from '@/lib/socket';
import { QrScanner } from '@/components/staff/QrScanner';
import { PushAlertCard } from '@/components/patient/PushAlertCard';
import { EditMyDetails } from '@/components/patient/EditMyDetails';
import { AddToHomeScreen } from '@/components/patient/AddToHomeScreen';
import { FullPageMessage, Icon, LoadingPage, PatientHeader } from '@/components/patient/ui';
import { dateLocale, localizeStatusDetail, useT } from '@/lib/i18n';

// Screen #3 — Live Queue / Token Tracking. Ported from
// stitch_medqr_clinic_suite_ui_design/patient_live_queue_tracking/code.html.
// States: Pre-Session (Decision 7 — no wait-time math until the session starts), Live token
// view, "Your turn" (pushed over the same socket event as the auto handoff, Decision 1), Done,
// and Missed. Dropped from the design because nothing backs them yet: time-slot view, delay
// notice, bottom tab bar, call/help/cancel/reschedule buttons, prescription-delivery step.

function toDisplayTime(hm: string) {
  const [h, m] = hm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function countdownTo(hm: string, now: Date) {
  const [h, m] = hm.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  const mins = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export default function LiveQueuePage() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const [view, setView] = useState<TokenStatusView | null>(null);
  const [scanning, setScanning] = useState(false); // Decision 21: arrival QR scanner open
  const [arriveError, setArriveError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState(() => new Date());
  
  const { t, lang } = useT(view?.patient_language);

  const [storedTokens, setStoredTokens] = useState<{id: string, number: number, patient_name: string, status: string, clinic_subdomain: string}[]>([]);

  useEffect(() => {
    if (view) {
      try {
        const stored = JSON.parse(localStorage.getItem('medqr_patient_tokens') || '[]');
        const index = stored.findIndex((x: any) => x.id === tokenId);
        const tokenData = {
          id: tokenId,
          number: view.token_number,
          patient_name: view.patient_name || 'Patient',
          doctor_name: view.doctor.name,
          doctor_photo_url: view.doctor.photo_url,
          status: view.status,
          clinic_subdomain: view.clinic.subdomain,
          timestamp: Date.now()
        };
        
        let newTokens = [...stored];
        if (index >= 0) {
          newTokens[index] = { ...newTokens[index], ...tokenData };
        } else {
          newTokens.push(tokenData);
        }
        newTokens = newTokens.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
        localStorage.setItem('medqr_patient_tokens', JSON.stringify(newTokens));
        
        setStoredTokens(newTokens.filter(x => x.id !== tokenId && x.status !== 'done' && x.status !== 'no_show' && x.status !== 'expired' && x.status !== 'cancelled'));
      } catch(e) {}
    }
  }, [view, tokenId]);

  const loaded = useRef(false);
  const [pay, setPay] = useState<PatientPaymentStatus | null>(null);

  const tokenCardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadToken = async () => {
    if (!tokenCardRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(tokenCardRef.current, { pixelRatio: 4, cacheBust: true, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `token-${view?.token_number}.png`;
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const refresh = useCallback(async () => {
    try {
      setView(await api.getToken(tokenId));
      api.paymentStatus(tokenId).then(setPay).catch(() => undefined);
      loaded.current = true;
    } catch {
      // Only a failed first load means a bad link; later blips keep showing the last good state.
      if (!loaded.current) setNotFound(true);
    }
  }, [tokenId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live updates: our own token room (called / checked in) + the doctor's room (queue moved).
  const doctorId = view?.doctor.id;
  useEffect(() => {
    if (!doctorId) return;
    const socket = getQueueSocket();
    const join = () => {
      socket.emit('join_token_room', tokenId);
      socket.emit('join_doctor_room', doctorId);
    };
    join();
    socket.on('connect', join);
    socket.on('queue:update', refresh);
    socket.on('session:changed', refresh);
    socket.on('queue:changed', refresh);
    // Safari/iOS: reconnect + refetch whenever the page comes back (see keepLive).
    const stopKeepLive = keepLive(refresh);
    return () => {
      socket.off('connect', join);
      socket.off('queue:update', refresh);
      socket.off('session:changed', refresh);
      socket.off('queue:changed', refresh);
      stopKeepLive();
    };
  }, [doctorId, tokenId, refresh]);

  // Tick for the pre-session countdown and estimated time; also lets the session start flip over.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      if (view && view.doctor_state.state !== 'live') refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [view, refresh]);

  if (notFound)
    return <FullPageMessage icon="confirmation_number" title={t('tk_not_found')} body={t('tk_not_found_body')} />;
  if (!view) return <LoadingPage />;

  const { doctor, clinic } = view;
  const cabin = doctor.cabin_label ?? t('tk_room');
  const staffWord = view.front_desk ? t('tk_desk') : t('tk_staff');
  const header = <PatientHeader eyebrow="ClinicQ Live" title={clinic.name} homeUrl={`/patient/${clinic.subdomain}/select-doctor`} />;

  // ---------- Your turn ----------
  if (view.status === 'in_consultation') {
    if (view.doctor_state.state === 'ended') {
      return (
        <>
          {header}
          <main className="min-h-screen w-full max-w-[480px] mx-auto pt-16 flex flex-col items-center justify-center text-center px-6 gap-3 bg-surface">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-tertiary-fixed text-on-tertiary-fixed">
              <Icon name="check" fill className="text-[28px]" />
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface">{t('session_ended')}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
              {t('thanks_get_well', { clinic: clinic.name })}
            </p>
            <div className="w-full max-w-xs mt-3">
              <Link href={`/patient/${clinic.subdomain}/select-doctor`} className="w-full h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center">
                {t('back_to_doctor_selection')}
              </Link>
            </div>
          </main>
        </>
      );
    }

    return (
      <>
        {header}
        <main className="min-h-screen w-full max-w-[480px] mx-auto pt-16 bg-primary-container text-on-primary flex flex-col items-center justify-center text-center px-6 gap-4">
          <div className="w-20 h-20 rounded-full bg-on-primary/15 flex items-center justify-center animate-pulse">
            <Icon name="notifications_active" fill className="text-[44px]" />
          </div>
          <p className="font-label-md text-label-md uppercase tracking-wider opacity-90">{t('tk_token_n', { number: view.token_number })}</p>
          <h1 className="font-headline-lg text-headline-lg">{t('its_your_turn')}</h1>
          <p className="font-headline-sm text-headline-sm">{t('go_to_cabin', { cabin })}</p>
          <p className="font-body-md text-body-md opacity-90">{t('doctor_ready', { doctor: doctor.name })}</p>
        </main>
      </>
    );
  }

  // ---------- Decision 17: booked for a future date — distinct from same-day Pre-Session ----------
  if (view.is_future_booking && view.booking_date) {
    const dateLabel = new Date(`${view.booking_date}T00:00:00`).toLocaleDateString(dateLocale(lang), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return (
      <>
        {header}
        <main className="min-h-screen w-full max-w-[480px] mx-auto pt-20 pb-10 bg-surface">
          <div className="flex flex-col w-full px-gutter space-y-space-md">
            <div className="w-full bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col items-center text-center gap-2 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-primary-fixed/20 rounded-full blur-2xl pointer-events-none" />
              <Icon name="event_available" className="text-primary text-[36px]" />
              <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-on-surface-variant">{t('youre_booked')}</span>
              <h1 className="font-headline-md text-headline-md text-primary tracking-tight">{dateLabel}</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">{t('with_doctor', { doctor: doctor.name })}{doctor.cabin_label ? ` · ${doctor.cabin_label}` : ''}</p>
              <div className="mt-2 inline-flex items-center gap-2 bg-surface-container-high text-on-surface px-4 py-1.5 rounded-full shadow-sm">
                <Icon name="tag" className="text-primary text-[18px]" />
                <span className="font-label-md text-label-md font-semibold">{t('tk_token_n', { number: view.token_number })}</span>
              </div>
              {view.ahead_tokens.length > 0 && (
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {view.ahead_tokens.length === 1 ? t('tk_booked_one') : t('patients_booked_ahead', { count: view.ahead_tokens.length })}
                </p>
              )}
            </div>
            <p className="text-center font-body-sm text-body-sm text-on-surface-variant px-4">
              {t('come_back_on_day')}
            </p>
          </div>
        </main>
      </>
    );
  }

  // ---------- Finished / missed ----------
  const payUrl = `/patient/${clinic.subdomain}/payment?token=${tokenId}`;

  // A token is only good for its own day — anything left over is closed at clinic midnight.
  if (view.status === 'expired') {
    return (
      <>
        {header}
        <main className="min-h-screen w-full max-w-[480px] mx-auto pt-16 flex flex-col items-center justify-center text-center px-6 gap-3 bg-surface">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-surface-container text-on-surface-variant">
            <Icon name="event_busy" className="text-[28px]" />
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{t('token_expired')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
            {t('token_for_earlier_day', { number: view.token_number })}
          </p>
          <div className="w-full max-w-xs mt-3">
            <Link href={`/patient/${clinic.subdomain}/select-doctor`} className="w-full h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center">
              {t('get_new_token')}
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (view.status === 'done' || view.status === 'no_show' || view.status === 'cancelled') {
    const done = view.status === 'done';
    const removed = view.status === 'cancelled'; // Decision 26: the clinic took this token out of the queue
    return (
      <>
        {header}
        <main className="min-h-screen w-full max-w-[480px] mx-auto pt-16 flex flex-col items-center justify-center text-center px-6 gap-3 bg-surface">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              done ? 'bg-tertiary-fixed text-on-tertiary-fixed' : removed ? 'bg-surface-container-high text-on-surface-variant' : 'bg-error-container text-error'
            }`}
          >
            <Icon name={done ? 'check' : removed ? 'event_busy' : 'schedule'} fill className="text-[28px]" />
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">
            {done ? t('consultation_complete') : removed ? t('token_cancelled') : t('token_missed')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
            {done
              ? t('thanks_visiting', { clinic: clinic.name })
              : removed
                ? t('clinic_removed_token', { clinic: clinic.name, staff: staffWord })
                : t('turn_called_away', { staff: staffWord })}
          </p>
          {done && pay && <div className="w-full max-w-xs mt-3"><PaymentCard pay={pay} payUrl={payUrl} afterVisit /></div>}
          <div className="w-full max-w-xs mt-3">
            <Link href={`/patient/${clinic.subdomain}/select-doctor`} className="w-full h-12 bg-surface-container-high text-on-surface rounded-xl font-label-lg text-label-lg flex items-center justify-center">
              {t('back_to_clinic')}
            </Link>
          </div>
        </main>
      </>
    );
  }

  const verified = view.status === 'waiting_in_clinic' || view.status === 'checked_in_early';
  // Decision 19: no reception desk → nobody verifies arrival; the doctor calls patients directly.
  const noDesk = !view.front_desk;
  // Decision 21: no desk, but the patient confirms arrival by scanning the clinic's arrival QR.
  const arrivalScan = noDesk && view.arrival_scan && !view.is_future_booking;
  const arrived = verified || (noDesk && !arrivalScan);
  // Pre-session = the doctor hasn't actually started (Start shift, or hours in auto mode) — Decision 7.
  const preSession = view.doctor_state.state === 'not_started';
  const plannedStart = view.session_starts_at;
  const onBreak = view.doctor_state.state === 'on_break';
  const shiftEnded = view.doctor_state.state === 'ended';
  const aheadCount = view.ahead_tokens.length;
  const waitMins = aheadCount * view.avg_consult_mins;
  const estTime = new Date(now.getTime() + waitMins * 60000).toLocaleTimeString(dateLocale(lang), {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Stepper nodes: who's in the cabin, up to 3 tokens ahead (with "+N" if more), then you.
  const shownAhead = view.ahead_tokens.slice(0, 3);
  const hiddenAhead = aheadCount - shownAhead.length;

  return (
    <>
      {header}
      <AddToHomeScreen active />
      <main className="min-h-screen w-full max-w-[480px] mx-auto pt-20 pb-10 bg-surface">
        <div className="flex flex-col w-full px-gutter space-y-space-md">
          {preSession && (
            <div className="w-full bg-surface-container-low text-on-surface p-space-sm px-space-md rounded-xl flex items-center gap-space-sm shadow-sm">
              <Icon name="info" className="text-primary text-[22px] flex-shrink-0" />
              <p className="font-body-sm text-body-sm leading-tight flex-1">
                <strong className="font-label-sm uppercase tracking-wider text-primary">{t('pre_session')}</strong> {t('doctor_not_started')}
              </p>
            </div>
          )}
          {onBreak && (
            <div className="w-full bg-secondary-fixed/50 text-on-secondary-fixed-variant p-space-sm px-space-md rounded-xl flex items-center gap-space-sm shadow-sm">
              <Icon name="coffee" className="text-secondary text-[22px] flex-shrink-0" />
              <p className="font-body-sm text-body-sm leading-tight flex-1">
                <strong className="font-label-sm uppercase tracking-wider text-secondary">{t('short_break')}</strong>{' '}
                {t('doctor_back_shortly', { doctor: doctor.name, detail: localizeStatusDetail(view.doctor_state.detail, t).toLowerCase() })}
              </p>
            </div>
          )}
          {shiftEnded && (
            <div className="w-full bg-error-container/60 text-on-error-container p-space-sm px-space-md rounded-xl flex items-center gap-space-sm shadow-sm">
              <Icon name="info" className="text-error text-[22px] flex-shrink-0" />
              <p className="font-body-sm text-body-sm leading-tight flex-1">
                {t('finished_for_today', { doctor: doctor.name, staff: staffWord })}
              </p>
            </div>
          )}
          {view.get_ready && !preSession && !onBreak && !shiftEnded && (
            <div className="w-full bg-tertiary-fixed/40 text-on-tertiary-fixed-variant p-space-sm px-space-md rounded-xl flex items-center gap-space-sm shadow-sm border border-tertiary/20">
              <Icon name="notifications_active" className="text-tertiary flex-shrink-0 text-[22px] animate-pulse" />
              <p className="font-body-sm text-body-sm leading-tight flex-1">
                <strong className="font-label-sm uppercase tracking-wider text-tertiary">{t('tk_get_ready')}</strong>{' '}
                {t('tk_get_ready_body', { place: doctor.cabin_label ?? doctor.name })}
              </p>
            </div>
          )}

          {/* Hero card */}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-primary-fixed/20 rounded-full blur-2xl pointer-events-none" />

            {preSession ? (
              <>
                <div className="flex items-center gap-1.5 text-on-surface-variant mb-1">
                  <Icon name="event" className="text-[18px] text-primary" />
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">{t('upcoming_session')}</span>
                </div>
                <div className="font-headline-lg text-headline-lg text-primary my-1 tracking-tight">
                  {plannedStart
                    ? t('session_starts_at', { doctor: doctor.name, time: toDisplayTime(plannedStart) })
                    : t('waiting_for_doctor', { doctor: doctor.name })}
                </div>
                <div className="mt-3 inline-flex items-center gap-2 bg-surface-container-high text-on-surface px-4 py-1.5 rounded-full shadow-sm">
                  <Icon name="tag" className="text-primary text-[18px]" />
                  <span className="font-label-md text-label-md font-semibold">{t('you_are_token', { number: view.token_number })}</span>
                </div>
                <div className="mt-4 w-full bg-surface-container-low rounded-xl p-space-md flex flex-col items-center space-y-1">
                  {plannedStart ? (
                    <>
                      <div className="flex items-center gap-1.5 text-secondary font-label-md text-label-md">
                        <Icon name="timer" className="text-[18px]" />
                        <span>{t('session_countdown')}</span>
                      </div>
                      <p className="font-numeric-metric text-numeric-metric text-on-surface tracking-tight">
                        {t('starts_in', { time: countdownTo(plannedStart, now) })}
                      </p>
                    </>
                  ) : (
                    <p className="font-headline-sm text-headline-sm text-on-surface">{t('doctor_start_shortly')}</p>
                  )}
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('wait_times_show_later')}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-on-surface-variant mb-1">
                  <Icon name="person_pin" className="text-[18px] text-primary" />
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">{t('your_token')}</span>
                </div>
                <div className="font-display-token text-display-token text-primary my-1">#{view.token_number}</div>
                <div className="mt-2 inline-flex items-center gap-2 bg-primary-fixed/50 text-on-primary-fixed-variant px-4 py-1.5 rounded-full shadow-sm">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                  <span className="font-label-md text-label-md">
                    {view.now_serving ? (
                      t('now_serving', { number: view.now_serving })
                    ) : (
                      t('doctor_will_call_shortly')
                    )}
                  </span>
                </div>

                <div className="w-full mt-6 pt-4 border-t border-surface-container">
                  <div className="relative flex items-center justify-between w-full px-2">
                    <div className="absolute left-6 right-6 top-[18px] h-1 bg-surface-container-high z-0" />
                    {view.now_serving && (
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-9 h-9 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center font-label-md text-label-md shadow-md">
                          {view.now_serving}
                        </div>
                        <span className="text-[10px] font-bold text-tertiary mt-1">{t('tk_in_cabin')}</span>
                      </div>
                    )}
                    {shownAhead.map((n, i) => (
                      <div key={n} className="relative z-10 flex flex-col items-center">
                        <div className="w-8 h-8 mt-0.5 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-label-sm text-label-sm shadow-sm">
                          {n}
                        </div>
                        <span className="text-[10px] text-outline mt-1">{i === 0 ? t('next') : t('wait')}</span>
                      </div>
                    ))}
                    {hiddenAhead > 0 && (
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-8 h-8 mt-0.5 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center font-label-sm text-label-sm">
                          +{hiddenAhead}
                        </div>
                        <span className="text-[10px] text-outline mt-1">{t('more')}</span>
                      </div>
                    )}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-10 h-10 -mt-0.5 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-sm text-headline-sm shadow-md ring-4 ring-primary-fixed/50">
                        {view.token_number}
                      </div>
                      <span className="text-[10px] font-bold text-primary mt-1">{t('you')}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Wait metric — live sessions only (Decision 7: no fake math pre-session) */}
          {!preSession && (
            <div className="w-full bg-surface-container-low rounded-2xl p-space-md flex items-center justify-between shadow-sm gap-3">
              <div className="flex items-center gap-space-sm min-w-0">
                <div className="w-12 h-12 rounded-xl bg-surface-container-lowest text-primary flex items-center justify-center shadow-sm flex-shrink-0">
                  <Icon name="hourglass_top" className="text-[26px]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
                    {aheadCount === 0 ? t('you_are_next') : t('wait_time_approx', { mins: waitMins })}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {aheadCount === 0
                      ? t('stay_close')
                      : aheadCount === 1
                        ? t('tk_ahead_one')
                        : t('patients_ahead', { count: aheadCount })}
                  </p>
                </div>
              </div>
              {aheadCount > 0 && (
                <div className="bg-surface-container-lowest px-3 py-1.5 rounded-lg text-right flex-shrink-0 shadow-sm">
                  <span className="font-label-sm text-label-sm text-outline block">{t('est_time')}</span>
                  <span className="font-label-lg text-label-lg font-bold text-on-surface">{estTime}</span>
                </div>
              )}
            </div>
          )}

          {/* Visit progress */}
          {view.push_available && !view.is_future_booking && (
            <PushAlertCard tokenId={tokenId} enabled={view.push_enabled} onChange={refresh} />
          )}
          {arrivalScan && !verified && (
            <div className="w-full bg-primary-fixed/25 ring-2 ring-primary/30 rounded-2xl p-space-md flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Icon name="qr_code_scanner" className="text-[28px] text-primary" />
                <div>
                  <p className="font-label-lg text-label-lg text-on-surface">{t('at_clinic_confirm')}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('scan_arrival_poster')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setArriveError(null);
                  setScanning(true);
                }}
                className="w-full h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2"
              >
                <Icon name="photo_camera" className="text-[20px]" /> {t('arrived_scan_qr')}
              </button>
              {arriveError && <p className="font-body-sm text-body-sm text-error">{arriveError}</p>}
            </div>
          )}
          {scanning && (
            <QrScanner
              onClose={() => setScanning(false)}
              onScan={async (value) => {
                setScanning(false);
                let code = value.trim();
                try {
                  code = new URL(code).searchParams.get('c') ?? code; // the poster encodes …/arrive?c=<code>
                } catch {
                  /* a bare code */
                }
                try {
                  await api.arriveByScan(tokenId, code);
                  await refresh();
                } catch (e) {
                  setArriveError(e instanceof Error ? e.message : t('tk_arrive_fail'));
                }
              }}
            />
          )}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">{t('visit_progress')}</h4>
              <span className="font-label-sm text-label-sm text-primary font-semibold">
                {preSession ? t('tk_awaiting') : t('live_tracking')}
              </span>
            </div>
            <div className="relative flex flex-col space-y-5 pl-2">
              <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-surface-container-high z-0" />
              <Step state="done" icon="check" title={t('token_booked')} subtitle={t('place_in_line_saved')} />
              {arrivalScan ? (
                <Step
                  state={verified ? 'done' : 'active'}
                  icon={verified ? 'check' : 'qr_code_scanner'}
                  title={verified ? t('arrival_confirmed') : t('confirm_arrival')}
                  subtitle={verified ? t('wait_nearby') : t('scan_arrival_qr')}
                />
              ) : noDesk ? (
                <Step
                  state="done"
                  icon="check"
                  title={t('no_checkin_needed')}
                  subtitle={t('doctor_calls_directly')}
                />
              ) : (
                <Step
                  state={verified ? 'done' : 'active'}
                  icon={verified ? 'check' : 'how_to_reg'}
                  title={verified ? t('verified_reception') : t('check_in_reception')}
                  subtitle={verified ? t('wait_in_lobby') : t('show_token_at_desk', { number: view.token_number })}
                />
              )}
              <Step
                state={arrived && !preSession ? 'active' : 'upcoming'}
                icon="stethoscope"
                title={t('consultation', { cabin: doctor.cabin_label ?? doctor.name })}
                subtitle={[doctor.name, doctor.qualification].filter(Boolean).join(', ')}
              />
            </div>
          </div>

          <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col items-center text-center">
            <div ref={tokenCardRef} style={{ background: '#fff', color: '#131b2e', fontFamily: 'Manrope, Inter, sans-serif' }} className="w-full max-w-[320px] flex flex-col items-center justify-center text-center p-6 rounded-2xl">
              <p style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>{clinic.name}</p>
              <p style={{ fontSize: 13, color: '#3e4947', marginTop: 3 }}>{doctor.name} {doctor.cabin_label ? `· ${doctor.cabin_label}` : ''}</p>
              <div style={{ marginTop: 20, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('your_token')}</span>
              </div>
              <p style={{ fontSize: 48, fontWeight: 800, color: '#005c55', lineHeight: 1 }}>#{view.token_number}</p>
              
              <div style={{ margin: '20px 0 12px', padding: 12, border: '2px solid #cfe9e5', borderRadius: 20 }}>
                {arrived ? (
                  <div style={{ padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
                    <Icon name="check_circle" className="text-[80px] text-primary" fill />
                  </div>
                ) : (
                  <QRCodeSVG value={tokenId} size={200} level="M" marginSize={2} fgColor="#00201d" bgColor="#ffffff" />
                )}
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0f766e' }}>
                {arrivalScan && !verified
                  ? t('tk_card_scan_arrival')
                  : noDesk
                    ? t('tk_card_wait_call')
                    : verified
                      ? t('verified_reception')
                      : t('tk_card_scan_reception')}
              </p>
              {!arrived && (
                <p style={{ fontSize: 11, color: '#3e4947', marginTop: 8, textTransform: 'uppercase' }}>
                  ID: {tokenId.split('-')[0]}
                </p>
              )}
            </div>
            {!verified && (
              <div className="w-full mt-2">
                <button
                  onClick={downloadToken}
                  disabled={downloading}
                  className="w-full h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 hover:opacity-90 transition-colors disabled:opacity-60"
                >
                  <Icon name={downloading ? 'progress_activity' : 'download'} className={`text-[20px] ${downloading ? 'animate-spin' : ''}`} />
                  {t('download_token')}
                </button>
                <button
                  onClick={() => {
                    const text = encodeURIComponent(t('tk_share', { number: view.token_number, doctor: doctor.name, clinic: clinic.name, url: window.location.href }));
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  className="w-full h-12 mt-3 bg-[#25D366] text-white rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 hover:opacity-90 transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.662-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  {t('share_whatsapp')}
                </button>
              </div>
            )}
          </div>

          {pay && <PaymentCard pay={pay} payUrl={payUrl} />}

          {/* Decision 38: change reason / weight / photos until called in */}
          <EditMyDetails tokenId={tokenId} />

          {/* Clinic card */}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-container/10 text-primary flex items-center justify-center flex-shrink-0">
              <Icon name="apartment" className="text-[24px]" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-label-lg text-label-lg font-bold text-on-surface truncate">{clinic.name}</span>
                <Icon name="verified" className="text-primary text-[16px]" />
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {view.patient_name ? `${view.patient_name} · ` : ''}
                {doctor.cabin_label ?? doctor.name}
              </span>
            </div>
          </div>

          {/* Multiple Tokens / Family Members */}
          <div className="w-full mt-4 flex flex-col gap-3">
            <Link 
              href={`/patient/${clinic.subdomain}/select-doctor`} 
              className="w-full h-12 border-2 border-primary text-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2"
            >
              <Icon name="person_add" className="text-[20px]" />
              {t('book_another')}
            </Link>

            {storedTokens.length > 0 && (
              <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm">
                <h4 className="font-headline-sm text-headline-sm text-on-surface mb-3">{t('tk_other_tokens')}</h4>
                <div className="flex flex-col gap-2">
                  {storedTokens.map(tk => (
                    <Link 
                      key={tk.id} 
                      href={`/patient/${tk.clinic_subdomain}/queue/${tk.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors"
                    >
                      <div>
                        <div className="font-label-md font-bold text-on-surface">{tk.patient_name}</div>
                        <div className="font-body-sm text-on-surface-variant text-[12px]">{t('tk_token_n', { number: tk.number })}</div>
                      </div>
                      <Icon name="arrow_forward_ios" className="text-[16px] text-on-surface-variant" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-center font-body-sm text-body-sm text-on-surface-variant px-4">
            {t('keep_page_open')}
          </p>

        </div>
      </main>
    </>
  );
}

function Step({
  state,
  icon,
  title,
  subtitle,
}: {
  state: 'done' | 'active' | 'upcoming';
  icon: string;
  title: string;
  subtitle: string;
}) {
  const { t } = useT();
  return (
    <div className={`relative z-10 flex items-start gap-space-md ${state === 'upcoming' ? 'opacity-60' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 ${
          state === 'done'
            ? 'bg-tertiary-container text-on-tertiary'
            : state === 'active'
              ? 'bg-primary text-on-primary ring-4 ring-primary-fixed/40'
              : 'bg-surface-container-high text-on-surface-variant'
        }`}
      >
        <Icon name={icon} className="text-[18px]" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`font-label-lg text-label-lg truncate ${
              state === 'active' ? 'text-primary font-bold' : 'text-on-surface font-semibold'
            }`}
          >
            {title}
          </span>
          {state === 'active' && (
            <span className="font-label-sm text-label-sm bg-primary-fixed/60 text-on-primary-fixed-variant px-2 py-0.5 rounded-full font-bold flex-shrink-0">
              {t('tk_now')}
            </span>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
      </div>
    </div>
  );
}

/** Fee status on the token screen (Decisions 8–10). Never blocks anything — it only informs and offers online pay. */
function PaymentCard({ pay, payUrl, afterVisit = false }: { pay: PatientPaymentStatus; payUrl: string; afterVisit?: boolean }) {
  const { t } = useT();
  if (pay.fee_inr <= 0) return null;
  const fee = `₹${pay.fee_inr.toLocaleString('en-IN')}`;

  if (pay.is_paid) {
    return (
      <div className="w-full bg-tertiary-fixed/30 rounded-2xl p-4 flex items-center gap-3 text-left">
        <Icon name="check_circle" fill className="text-tertiary text-[24px]" />
        <p className="font-label-lg text-label-lg text-on-tertiary-fixed-variant">
          {t('fee_paid', { fee, online: pay.payment_method === 'upi_online' ? t('tk_online') : '' })}
        </p>
      </div>
    );
  }
  // Pay-after-consultation clinics: say nothing about paying until the visit is done.
  if (pay.payment_mode === 'pay_after_consultation' && !afterVisit) {
    return (
      <div className="w-full bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 text-left">
        <Icon name="schedule" className="text-primary text-[22px]" />
        <p className="font-body-md text-body-md text-on-surface-variant">{t('fee_collected_after')}</p>
      </div>
    );
  }
  return (
    <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-3 text-left">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
          <Icon name="currency_rupee" className="text-[22px]" />
        </span>
        <div className="flex-1">
          <p className="font-label-lg text-label-lg text-on-surface">{t('consultation_fee', { fee })}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {pay.payment_choice === 'cash' ? t('chose_pay_counter') : t('pay_online_or_counter')}
          </p>
        </div>
      </div>
      {pay.online_available && (
        <Link href={payUrl} className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-2">
          <Icon name="qr_code_scanner" className="text-[18px]" />
          {pay.payment_choice === 'online' && pay.qr ? t('continue_upi') : t('pay_online', { fee })}
        </Link>
      )}
    </div>
  );
}

