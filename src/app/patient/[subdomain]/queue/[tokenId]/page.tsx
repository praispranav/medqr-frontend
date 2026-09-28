'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, type PatientPaymentStatus, type TokenStatusView } from '@/lib/api';
import { getQueueSocket } from '@/lib/socket';
import { FullPageMessage, Icon, LoadingPage, PatientHeader } from '@/components/patient/ui';

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
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const loaded = useRef(false);
  const [pay, setPay] = useState<PatientPaymentStatus | null>(null);

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
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      socket.off('connect', join);
      socket.off('queue:update', refresh);
      socket.off('session:changed', refresh);
      socket.off('queue:changed', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [doctorId, tokenId, refresh]);

  // Tick for the pre-session countdown and estimated time; also lets the session start flip over.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      if (view?.session_starts_at) refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [view?.session_starts_at, refresh]);

  if (notFound)
    return <FullPageMessage icon="confirmation_number" title="Token not found" body="This link may have expired. Please ask the reception desk." />;
  if (!view) return <LoadingPage />;

  const { doctor, clinic } = view;
  const cabin = doctor.cabin_label ?? 'the consultation room';
  const header = <PatientHeader eyebrow="MedQR Live" title={clinic.name} />;

  // ---------- Your turn ----------
  if (view.status === 'in_consultation') {
    return (
      <>
        {header}
        <main className="min-h-screen w-full max-w-[480px] mx-auto pt-16 bg-primary-container text-on-primary flex flex-col items-center justify-center text-center px-6 gap-4">
          <div className="w-20 h-20 rounded-full bg-on-primary/15 flex items-center justify-center animate-pulse">
            <Icon name="notifications_active" fill className="text-[44px]" />
          </div>
          <p className="font-label-md text-label-md uppercase tracking-wider opacity-90">Token #{view.token_number}</p>
          <h1 className="font-headline-lg text-headline-lg">It&apos;s your turn</h1>
          <p className="font-headline-sm text-headline-sm">Please go to {cabin}</p>
          <p className="font-body-md text-body-md opacity-90">{doctor.name} is ready to see you.</p>
        </main>
      </>
    );
  }

  // ---------- Finished / missed ----------
  const payUrl = `/patient/${clinic.subdomain}/payment?token=${tokenId}`;

  if (view.status === 'done' || view.status === 'no_show') {
    const done = view.status === 'done';
    return (
      <>
        {header}
        <main className="min-h-screen w-full max-w-[480px] mx-auto pt-16 flex flex-col items-center justify-center text-center px-6 gap-3 bg-surface">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              done ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-error-container text-error'
            }`}
          >
            <Icon name={done ? 'check' : 'schedule'} fill className="text-[28px]" />
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">
            {done ? 'Consultation complete' : 'Your token was missed'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
            {done
              ? `Thank you for visiting ${clinic.name}. Get well soon!`
              : 'Your turn was called while you were away. Please speak to the reception desk.'}
          </p>
          {done && pay && <div className="w-full max-w-xs mt-3"><PaymentCard pay={pay} payUrl={payUrl} afterVisit /></div>}
        </main>
      </>
    );
  }

  const verified = view.status === 'waiting_in_clinic' || view.status === 'checked_in_early';
  const preSession = view.session_starts_at;
  const aheadCount = view.ahead_tokens.length;
  const waitMins = aheadCount * view.avg_consult_mins;
  const estTime = new Date(now.getTime() + waitMins * 60000).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Stepper nodes: who's in the cabin, up to 3 tokens ahead (with "+N" if more), then you.
  const shownAhead = view.ahead_tokens.slice(0, 3);
  const hiddenAhead = aheadCount - shownAhead.length;

  return (
    <>
      {header}
      <main className="min-h-screen w-full max-w-[480px] mx-auto pt-20 pb-10 bg-surface">
        <div className="flex flex-col w-full px-gutter space-y-space-md">
          {preSession && (
            <div className="w-full bg-surface-container-low text-on-surface p-space-sm px-space-md rounded-xl flex items-center gap-space-sm shadow-sm">
              <Icon name="info" className="text-primary text-[22px] flex-shrink-0" />
              <p className="font-body-sm text-body-sm leading-tight flex-1">
                <strong className="font-label-sm uppercase tracking-wider text-primary">Pre-Session:</strong> The doctor&apos;s
                session starts later. Your place in line is already saved.
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
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Upcoming session</span>
                </div>
                <div className="font-headline-lg text-headline-lg text-primary my-1 tracking-tight">
                  {doctor.name}&apos;s session starts at {toDisplayTime(preSession)}
                </div>
                <div className="mt-3 inline-flex items-center gap-2 bg-surface-container-high text-on-surface px-4 py-1.5 rounded-full shadow-sm">
                  <Icon name="tag" className="text-primary text-[18px]" />
                  <span className="font-label-md text-label-md font-semibold">You&apos;re Token #{view.token_number}</span>
                </div>
                <div className="mt-4 w-full bg-surface-container-low rounded-xl p-space-md flex flex-col items-center space-y-1">
                  <div className="flex items-center gap-1.5 text-secondary font-label-md text-label-md">
                    <Icon name="timer" className="text-[18px]" />
                    <span>Session countdown</span>
                  </div>
                  <p className="font-numeric-metric text-numeric-metric text-on-surface tracking-tight">
                    Starts in {countdownTo(preSession, now)}
                  </p>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Wait times show once the doctor starts seeing patients
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-on-surface-variant mb-1">
                  <Icon name="person_pin" className="text-[18px] text-primary" />
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Your token</span>
                </div>
                <div className="font-display-token text-display-token text-primary my-1">#{view.token_number}</div>
                <div className="mt-2 inline-flex items-center gap-2 bg-primary-fixed/50 text-on-primary-fixed-variant px-4 py-1.5 rounded-full shadow-sm">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                  <span className="font-label-md text-label-md">
                    {view.now_serving ? (
                      <>
                        Now serving: <strong className="font-bold">#{view.now_serving}</strong>
                      </>
                    ) : (
                      'Doctor will call the first token shortly'
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
                        <span className="text-[10px] font-bold text-tertiary mt-1">In cabin</span>
                      </div>
                    )}
                    {shownAhead.map((n, i) => (
                      <div key={n} className="relative z-10 flex flex-col items-center">
                        <div className="w-8 h-8 mt-0.5 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-label-sm text-label-sm shadow-sm">
                          {n}
                        </div>
                        <span className="text-[10px] text-outline mt-1">{i === 0 ? 'Next' : 'Wait'}</span>
                      </div>
                    ))}
                    {hiddenAhead > 0 && (
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-8 h-8 mt-0.5 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center font-label-sm text-label-sm">
                          +{hiddenAhead}
                        </div>
                        <span className="text-[10px] text-outline mt-1">More</span>
                      </div>
                    )}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-10 h-10 -mt-0.5 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-sm text-headline-sm shadow-md ring-4 ring-primary-fixed/50">
                        {view.token_number}
                      </div>
                      <span className="text-[10px] font-bold text-primary mt-1">You</span>
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
                    {aheadCount === 0 ? "You're next" : `~${waitMins} min wait`}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {aheadCount === 0
                      ? 'Stay close to the cabin'
                      : `${aheadCount} ${aheadCount === 1 ? 'patient' : 'patients'} ahead of you`}
                  </p>
                </div>
              </div>
              {aheadCount > 0 && (
                <div className="bg-surface-container-lowest px-3 py-1.5 rounded-lg text-right flex-shrink-0 shadow-sm">
                  <span className="font-label-sm text-label-sm text-outline block">EST. TIME</span>
                  <span className="font-label-lg text-label-lg font-bold text-on-surface">{estTime}</span>
                </div>
              )}
            </div>
          )}

          {pay && <PaymentCard pay={pay} payUrl={payUrl} />}

          {/* Visit progress */}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">Visit progress</h4>
              <span className="font-label-sm text-label-sm text-primary font-semibold">
                {preSession ? 'Awaiting session' : 'Live tracking'}
              </span>
            </div>
            <div className="relative flex flex-col space-y-5 pl-2">
              <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-surface-container-high z-0" />
              <Step state="done" icon="check" title="Token booked" subtitle="Your place in line is saved" />
              <Step
                state={verified ? 'done' : 'active'}
                icon={verified ? 'check' : 'how_to_reg'}
                title={verified ? 'Verified at reception' : 'Check in at reception'}
                subtitle={verified ? 'Please wait in the lobby, within calling range' : `Show Token #${view.token_number} at the desk when you arrive`}
              />
              <Step
                state={verified && !preSession ? 'active' : 'upcoming'}
                icon="stethoscope"
                title={`Consultation · ${doctor.cabin_label ?? doctor.name}`}
                subtitle={[doctor.name, doctor.qualification].filter(Boolean).join(', ')}
              />
            </div>
          </div>

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

          <p className="text-center font-body-sm text-body-sm text-on-surface-variant px-4">
            Keep this page open — it updates by itself when the queue moves.
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
              Now
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
  if (pay.fee_inr <= 0) return null;
  const fee = `₹${pay.fee_inr.toLocaleString('en-IN')}`;

  if (pay.is_paid) {
    return (
      <div className="w-full bg-tertiary-fixed/30 rounded-2xl p-4 flex items-center gap-3 text-left">
        <Icon name="check_circle" fill className="text-tertiary text-[24px]" />
        <p className="font-label-lg text-label-lg text-on-tertiary-fixed-variant">
          Fee paid · {fee} {pay.payment_method === 'upi_online' ? '(online)' : ''}
        </p>
      </div>
    );
  }
  // Pay-after-consultation clinics: say nothing about paying until the visit is done.
  if (pay.payment_mode === 'pay_after_consultation' && !afterVisit) {
    return (
      <div className="w-full bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 text-left">
        <Icon name="schedule" className="text-primary text-[22px]" />
        <p className="font-body-md text-body-md text-on-surface-variant">The consultation fee is collected after your visit.</p>
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
          <p className="font-label-lg text-label-lg text-on-surface">Consultation fee {fee}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {pay.payment_choice === 'cash' ? 'You chose to pay at the counter.' : 'Pay online now, or at the counter.'}
          </p>
        </div>
      </div>
      {pay.online_available && (
        <Link href={payUrl} className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-2">
          <Icon name="qr_code_scanner" className="text-[18px]" />
          {pay.payment_choice === 'online' && pay.qr ? 'Continue UPI payment' : `Pay ${fee} online`}
        </Link>
      )}
    </div>
  );
}

