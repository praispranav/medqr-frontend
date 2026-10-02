'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, type DoctorToday, type QueueRow, type ShiftView, type Tenant } from '@/lib/api';
import { ShiftBar } from '@/components/staff/ShiftBar';
import { Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { useLiveQueue } from '@/components/staff/useLiveQueue';
import { minutesSince, PaidBadge, STATUS_LABEL, StatusPill, VitalsChips } from '@/components/staff/bits';

// Screen #5 — Doctor Queue Command Center. Ported from
// stitch_medqr_clinic_suite_ui_design/doctor_queue_command_center/code.html.
// "Complete & call next" and per-row "Call now" both go through the Decision 1 auto handoff
// (the current patient is auto-closed, non-blocking — Option A), broadcast on the same socket
// event reception listens to. Dropped from the design (nothing behind them yet): booking-mode
// switcher (lives in Queue Rules), PA speaker/buzzer, WhatsApp wallet chip, cadence timer controls,
// auto-advance dropdown.

export default function DoctorDashboardPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/dashboard">
      {({ tenant, doctor }) => <CommandCenter tenant={tenant} doctor={doctor!} />}
    </StaffShell>
  );
}

const CALLABLE = new Set(['waiting_in_clinic', 'checked_in_early']);

function CommandCenter({ tenant, doctor }: { tenant: Tenant; doctor: DoctorToday }) {
  const { rows, refresh } = useLiveQueue(tenant.id, [doctor.id], doctor.id);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [shift, setShift] = useState<ShiftView | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  // Shift state rides on the same live events as the queue (any change broadcasts queue:changed).
  useEffect(() => {
    api.doctorShift(doctor.id).then(setShift).catch(() => undefined);
  }, [doctor.id, rows]);
  useEffect(() => {
    const id = setInterval(() => api.doctorShift(doctor.id).then(setShift).catch(() => undefined), 60_000);
    return () => clearInterval(id);
  }, [doctor.id]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const current = rows?.find((r) => r.status === 'in_consultation') ?? null;
  const callable = useMemo(() => {
    if (tenant.queue_settings.front_desk_verifies_arrivals === false) {
      return (rows ?? []).filter((r) => CALLABLE.has(r.status) || r.status === 'booked');
    }
    return (rows ?? []).filter((r) => CALLABLE.has(r.status));
  }, [rows, tenant.queue_settings.front_desk_verifies_arrivals]);
  const notArrived = useMemo(() => (rows ?? []).filter((r) => r.status === 'booked'), [rows]);
  const finished = useMemo(() => (rows ?? []).filter((r) => r.status === 'done' || r.status === 'no_show'), [rows]);
  const next = callable[0] ?? null;

  const filter = (list: QueueRow[]) => {
    const q = query.trim().toLowerCase().replace(/^#/, '');
    if (!q) return list;
    return list.filter((r) => String(r.token_number) === q || r.patient?.name.toLowerCase().includes(q));
  };

  const avg = tenant.queue_settings.avg_consult_mins;
  const estFinish = new Date(now + (callable.length + (current ? 1 : 0)) * avg * 60000).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const live = shift?.state === 'live';
  const breakDue = live && shift?.break_after_patients === 0;
  const notLiveReason = !shift
    ? ''
    : shift.state === 'not_started'
      ? shift.mode === 'manual'
        ? 'Tap Start shift to begin calling patients.'
        : `Your consulting hours start ${shift.today_status_detail.replace(/^From /, 'at ')}.`
      : shift.state === 'on_break'
        ? 'You are on a break — tap End break to continue.'
        : shift.state === 'ended'
          ? 'Your shift has ended for today.'
          : '';

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setCallError(null);
    try {
      await fn();
      await refresh();
      setShift(await api.doctorShift(doctor.id));
    } catch (e) {
      setCallError(e instanceof ApiError ? e.message : 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const callNext = () => run(() => api.callNext(doctor.id));

  // Design: "Press Enter" completes and calls the next patient (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== 'Enter' || busy || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName)) return;
      if (live && (next || current)) callNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-5 max-w-[1400px] pb-24 xl:pb-0">
      <div className="flex flex-col gap-5 min-w-0">
        <ShiftBar doctorId={doctor.id} shift={shift} hasPatientInCabin={!!current} onChanged={(v) => { setShift(v); refresh(); }} />
        {!live && notLiveReason && (
          <p className="flex items-center gap-2 bg-secondary-fixed/40 text-on-secondary-fixed-variant rounded-xl px-4 py-3 font-label-lg text-label-lg">
            <Icon name="info" className="text-[20px]" /> {notLiveReason}
          </p>
        )}
        {callError && <p className="font-body-md text-body-md text-error">{callError}</p>}
        {/* ---------- Now serving ---------- */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 lg:p-6 shadow-sm flex flex-col gap-5 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary-fixed/20 pointer-events-none" />
          <div className="flex items-center justify-between gap-3 relative">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm uppercase">
              <span className="w-2 h-2 rounded-full bg-tertiary" />
              {current ? `Now serving${doctor.cabin_label ? ` in ${doctor.cabin_label}` : ''}` : 'Cabin free'}
            </span>
            {current?.called_at && (
              <span className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant">
                <Icon name="schedule" className="text-[18px]" />
                Called {minutesSince(current.called_at, now)}m ago
              </span>
            )}
          </div>

          {current ? (
            <>
              <div className="flex flex-col sm:flex-row gap-5 relative">
                <div className="rounded-2xl bg-surface-container-low px-5 py-3 text-center self-start">
                  <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Token</p>
                  <p className="font-display-token text-display-token text-primary">#{current.token_number}</p>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">{current.patient?.name ?? 'Patient'}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {(current.patient?.age || current.patient?.gender) && (
                      <span className="px-2.5 py-1 rounded-lg bg-surface-container font-label-md text-label-md">
                        {[current.patient?.age ? `${current.patient.age}y` : null, current.patient?.gender].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {current.patient && (
                      <span className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
                        <Icon name="call" className="text-[16px]" /> +91 {current.patient.mobile_number}
                      </span>
                    )}
                    <PaidBadge row={current} showDue />
                    {tenant.queue_settings.payment_mode === 'pay_after_consultation' && current.visit && !current.visit.is_paid && (
                      <div className="flex items-center gap-2 ml-auto">
                        <button disabled={busy} onClick={() => run(() => api.markPaid(current.visit!.id, 'cash', Number(current.visit!.consultation_fee_inr ?? tenant.queue_settings.default_consultation_fee_inr)))} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm disabled:opacity-60">
                          {busy ? 'Processing...' : 'Paid · Cash'}
                        </button>
                        <button disabled={busy} onClick={() => run(() => api.markPaid(current.visit!.id, 'upi_counter', Number(current.visit!.consultation_fee_inr ?? tenant.queue_settings.default_consultation_fee_inr)))} className="px-3 py-1.5 rounded-lg bg-surface-container-low text-primary font-label-sm text-label-sm disabled:opacity-60">
                          {busy ? 'Processing...' : 'Paid · UPI'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(current.visit?.chief_complaint || current.visit?.vitals) && (
                <div className="bg-surface-container-low rounded-xl p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                  {current.visit?.chief_complaint && (
                    <div className="flex items-start gap-2.5 flex-1">
                      <Icon name="stethoscope" className="text-primary text-[22px] mt-0.5" />
                      <div>
                        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Reason for visit</p>
                        <p className="font-headline-sm text-headline-sm text-on-surface">{current.visit.chief_complaint}</p>
                      </div>
                    </div>
                  )}
                  <VitalsChips vitals={current.visit?.vitals} />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {current.visit && (
                  <Link
                    href={`/doctor/consultation/${current.visit.id}`}
                    className="h-14 px-5 rounded-xl bg-surface-container-low text-primary font-label-lg text-label-lg flex items-center justify-center gap-2 hover:bg-surface-container"
                  >
                    <Icon name="edit_note" className="text-[22px]" />
                    Open consultation
                  </Link>
                )}
                <button
                  disabled={busy || !live}
                  onClick={callNext}
                  className={`w-full sm:w-auto sm:flex-1 shrink-0 h-14 px-5 rounded-xl text-on-primary font-label-lg text-label-lg flex items-center justify-between gap-3 shadow-md disabled:opacity-50 ${
                    breakDue ? 'bg-secondary' : 'bg-primary-container'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon name={breakDue ? 'coffee' : 'arrow_forward'} className="text-[22px]" />
                    <span className="truncate">
                      {breakDue
                        ? 'Complete & start break'
                        : next
                          ? `Complete & call #${next.token_number} ${next.patient?.name ?? ''}`
                          : 'Complete visit'}
                    </span>
                  </span>
                  <span className="hidden sm:inline px-2 py-1 rounded-lg bg-on-primary/15 font-label-sm text-label-sm">Enter ↵</span>
                </button>
              </div>
              <button
                disabled={busy}
                onClick={() => run(() => api.markNoShow(current.id))}
                className="self-start h-11 px-4 rounded-xl bg-error-container text-on-error-container font-label-md text-label-md flex items-center gap-2 disabled:opacity-60"
              >
                <Icon name="person_off" className="text-[18px]" />
                Didn&apos;t come in — mark no-show
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center text-center gap-3 py-6 relative">
              <Icon name="event_seat" className="text-[44px] text-primary" />
              <p className="font-headline-md text-headline-md text-on-surface">
                {next ? `Next up: #${next.token_number} ${next.patient?.name ?? ''}` : 'Nobody is waiting yet'}
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                {next
                  ? 'Call them in when you are ready.'
                  : notArrived.length > 0
                    ? `${notArrived.length} booked patient${notArrived.length > 1 ? 's have' : ' has'} not been verified at reception yet.`
                    : 'Patients appear here once reception verifies they have arrived.'}
              </p>
              {next && (
                <button
                  disabled={busy || !live}
                  onClick={callNext}
                  className="h-14 px-8 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg flex items-center gap-2 shadow-md disabled:opacity-60"
                >
                  <Icon name="campaign" className="text-[22px]" />
                  Call #{next.token_number}
                </button>
              )}
            </div>
          )}
        </section>

        {/* ---------- Stats ---------- */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Seen today', String(finished.filter((r) => r.status === 'done').length), 'text-on-surface', 'patients'],
            ['Waiting', String(callable.length), 'text-primary', 'verified at reception'],
            ['Not arrived', String(notArrived.length), 'text-secondary', 'booked, not verified'],
            ['Est. finish', estFinish, 'text-on-surface', `at ~${avg} min / patient`],
          ].map(([label, value, cls, sub]) => (
            <div key={label} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</p>
              <p className={`font-numeric-metric text-numeric-metric ${cls}`}>{value}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{sub}</p>
            </div>
          ))}
        </section>
      </div>

      {/* ---------- Live patient queue ---------- */}
      <section id="queue-list-section" className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4 min-w-0 xl:max-h-[calc(100vh-7rem)] xl:sticky xl:top-20">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Live patient queue</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadTodayPatientsCsv(rows ?? [], doctor.name)}
              disabled={!rows?.length}
              aria-label="Export today's patients to Excel"
              title="Export today's patients (Excel/CSV)"
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low disabled:opacity-40"
            >
              <Icon name="download" className="text-[18px]" />
            </button>
            <span className="px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
              {callable.length} waiting
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 h-11">
          <Icon name="search" className="text-on-surface-variant text-[20px]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search token # or patient name…"
            className="flex-1 bg-transparent font-body-md text-body-md focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto -mx-1 px-1">
          {rows === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
          {filter(callable).map((r, i) => (
            <QueueItem key={r.id} row={r} now={now}>
              {i === 0 && !query ? (
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">Next up</span>
              ) : (
                <button
                  disabled={busy || !live || breakDue}
                  onClick={() => run(() => api.callToken(r.id))}
                  title="Priority jump — call this patient now"
                  className="h-9 px-3 rounded-lg bg-surface-container text-primary font-label-md text-label-md flex items-center gap-1 hover:bg-surface-container-high disabled:opacity-60"
                >
                  <Icon name="arrow_upward" className="text-[16px]" /> Call now
                </button>
              )}
            </QueueItem>
          ))}

          {tenant.queue_settings.front_desk_verifies_arrivals !== false && filter(notArrived).length > 0 && (
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-3">Booked · not arrived yet</p>
          )}
          {tenant.queue_settings.front_desk_verifies_arrivals !== false && filter(notArrived).map((r) => (
            <QueueItem key={r.id} row={r} now={now} muted>
              <div className="flex items-center gap-3">
                <StatusPill status={r.status} />
                <button
                  disabled={busy || !live || breakDue}
                  onClick={() => {
                    if (confirm("This patient hasn't been confirmed as arrived — call anyway?")) {
                      run(() => api.callToken(r.id));
                    }
                  }}
                  title="Override — call this patient now"
                  className="h-9 px-3 rounded-lg bg-surface-container text-primary font-label-md text-label-md flex items-center gap-1 hover:bg-surface-container-high disabled:opacity-60"
                >
                  <Icon name="arrow_upward" className="text-[16px]" /> Call now
                </button>
              </div>
            </QueueItem>
          ))}

          {filter(finished).length > 0 && (
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mt-3">Finished today</p>
          )}
          {filter(finished).map((r) => (
            <QueueItem key={r.id} row={r} now={now} muted>
              {r.visit && r.status === 'done' ? (
                <Link href={`/doctor/consultation/${r.visit.id}`} className="font-label-md text-label-md text-primary">
                  Notes
                </Link>
              ) : (
                <StatusPill status={r.status} />
              )}
            </QueueItem>
          ))}

          {rows && rows.length === 0 && (
            <p className="font-body-md text-body-md text-on-surface-variant py-6 text-center">No tokens yet today.</p>
          )}
        </div>
      </section>

      {/* Mobile fixed bottom bar */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest border-t border-surface-container p-4 pb-safe flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => {
            const el = document.getElementById('queue-list-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex-1 h-14 rounded-xl bg-surface-container-low text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-2"
        >
          <Icon name="list" className="text-[22px]" />
          Queue list
        </button>
        <button
          disabled={busy || !live}
          onClick={callNext}
          className={`flex-[2] h-14 px-5 rounded-xl text-on-primary font-label-lg text-label-lg flex items-center justify-between gap-3 shadow-md disabled:opacity-50 ${
            breakDue ? 'bg-secondary' : 'bg-primary'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Icon name={breakDue ? 'coffee' : 'campaign'} className="text-[22px]" />
            <span className="truncate">
              {breakDue ? 'Start break' : next ? `Call #${next.token_number}` : 'Call next'}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

/** Doctor's own "export today" — tabular data only, deliberately no photos/attachments (those live on the visit, not this list). */
function downloadTodayPatientsCsv(rows: QueueRow[], doctorName: string) {
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Token', 'Patient', 'Age', 'Gender', 'Mobile', 'Status', 'Reason for visit', 'Joined at', 'Called at'];
  const lines = [
    header.map(cell).join(','),
    ...[...rows]
      .sort((a, b) => a.token_number - b.token_number)
      .map((r) =>
        [
          r.token_number,
          r.patient?.name ?? '',
          r.patient?.age ?? '',
          r.patient?.gender ?? '',
          r.patient?.mobile_number ?? '',
          STATUS_LABEL[r.status],
          r.visit?.chief_complaint ?? '',
          new Date(r.joined_at).toLocaleString('en-IN'),
          r.called_at ? new Date(r.called_at).toLocaleString('en-IN') : '',
        ]
          .map(cell)
          .join(','),
      ),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doctorName.replace(/[^a-z0-9]+/gi, '-')}-patients-${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function QueueItem({ row, now, muted = false, children }: { row: QueueRow; now: number; muted?: boolean; children: React.ReactNode }) {
  const waited = minutesSince(row.joined_at, now);
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${muted ? 'bg-surface-container-low opacity-70' : 'bg-surface-container-low'}`}>
      <span className="font-headline-md text-headline-md text-primary w-14 shrink-0">#{row.token_number}</span>
      <div className="flex-1 min-w-0">
        <p className="font-label-lg text-label-lg text-on-surface truncate">
          {row.patient?.name ?? 'Patient'}
          {row.patient?.age ? <span className="text-on-surface-variant font-normal"> · {row.patient.age}y</span> : null}
        </p>
        <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
          {[waited !== null ? `joined ${waited}m ago` : null, row.visit?.chief_complaint].filter(Boolean).join(' · ')}
        </p>
      </div>
      {children}
    </div>
  );
}
