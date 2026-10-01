'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type DoctorToday, type PaymentEvent, type PaymentQrView, type QueueRow, type ShiftView, type Tenant, type Vitals } from '@/lib/api';
import { PaymentLog } from '@/components/payments/PaymentLog';
import { UpiQrCard } from '@/components/payments/UpiQrCard';
import { Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { useLiveQueue } from '@/components/staff/useLiveQueue';
import { inr, minutesSince, PaidBadge, StatusPill, VitalsChips } from '@/components/staff/bits';

// Screen #4 — Reception Verifier. Ported from
// stitch_medqr_clinic_suite_ui_design/reception_verifier_portal/code.html (desktop) with the
// single-column behaviour of reception_verifier_mobile.
// The camera scanner panel isn't here: the patient's token screen has no scannable code yet, so
// the design's "Manual Search / Fallback Arrival" is the primary way in (token #, phone or name).
// Wiring:
// - Verify -> POST /queue/tokens/:id/check-in (Booked -> Waiting / Arrived early, Decision 7)
// - Vitals strip -> POST /patients/visits/:visitId/vitals, every field optional (Decision 5)
// - Payment tag driven by tenant.queue_settings.payment_mode (Decision 8); never blocks (Decision 9)
// - Print Token Slip only when tenant.queue_settings.print_slip_on_checkin (Decision 2)
// - "Call next" per doctor only when advance_mode === 'reception'

const VERIFIED = new Set(['waiting_in_clinic', 'checked_in_early', 'in_consultation', 'done']);

type PayConfig = { gateway: 'razorpay' | 'mock'; online_available: boolean };

/** Reception should chase this fee now (Decision 8: pay-after clinics only owe once the visit is done). */
function owes(r: QueueRow, tenant: Tenant) {
  if (!r.visit || r.visit.is_paid || r.status === 'no_show' || Number(r.visit.consultation_fee_inr ?? 0) <= 0) return false;
  return tenant.queue_settings.payment_mode !== 'pay_after_consultation' || r.status === 'done';
}

function matches(row: QueueRow, q: string) {
  const s = q.trim().toLowerCase().replace(/^#/, '');
  if (!s) return false;
  if (/^\d{1,3}$/.test(s)) return row.token_number === Number(s);
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 4 && row.patient?.mobile_number.includes(digits)) return true;
  return !!row.patient?.name.toLowerCase().includes(s);
}

export default function ReceptionPage() {
  return (
    <StaffShell variant="reception" active="/reception">
      {({ tenant, doctors }) => <ReceptionDesk tenant={tenant} doctors={doctors} />}
    </StaffShell>
  );
}

function ReceptionDesk({ tenant, doctors }: { tenant: Tenant; doctors: DoctorToday[] }) {
  const { rows, refresh, connected } = useLiveQueue(
    tenant.id,
    doctors.map((d) => d.id),
  );
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tokenId: string; kind: 'verified' | 'duplicate' } | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [payConfig, setPayConfig] = useState<PayConfig | null>(null);
  const [shifts, setShifts] = useState<(ShiftView & { doctor_name: string })[]>([]);

  // Doctors' live shift state (Start shift / break / ended) — refreshes with every queue event.
  const loadShifts = useCallback(() => {
    api.clinicShifts(tenant.id).then(setShifts).catch(() => undefined);
  }, [tenant.id]);
  useEffect(() => {
    loadShifts();
  }, [loadShifts, rows]);
  useEffect(() => {
    const id = setInterval(loadShifts, 60_000);
    return () => clearInterval(id);
  }, [loadShifts]);

  useEffect(() => {
    api.paymentConfig().then(setPayConfig).catch(() => setPayConfig({ gateway: 'mock', online_available: false }));
  }, []);

  const results = useMemo(() => (rows ?? []).filter((r) => matches(r, query)), [rows, query]);
  const selected = rows?.find((r) => r.id === selectedId) ?? null;
  const multiDoctor = doctors.length > 1;

  const visible = useMemo(() => {
    const list = (rows ?? []).filter(
      (r) => (doctorFilter === 'all' || r.doctor.id === doctorFilter) && (!unpaidOnly || owes(r, tenant)),
    );
    const order = { in_consultation: 0, waiting_in_clinic: 1, checked_in_early: 2, booked: 3, no_show: 4, done: 5 };
    return [...list].sort((a, b) => order[a.status] - order[b.status] || a.token_number - b.token_number);
  }, [rows, doctorFilter, unpaidOnly, tenant]);

  const stats = useMemo(() => {
    const r = rows ?? [];
    return {
      verified: r.filter((x) => VERIFIED.has(x.status)).length,
      waiting: r.filter((x) => x.status === 'waiting_in_clinic' || x.status === 'checked_in_early').length,
      inCabin: r.filter((x) => x.status === 'in_consultation').length,
      notArrived: r.filter((x) => x.status === 'booked').length,
      unpaid: r.filter((x) => owes(x, tenant)).length,
    };
  }, [rows, tenant]);

  const verify = async (row: QueueRow) => {
    setSelectedId(row.id);
    if (VERIFIED.has(row.status)) {
      setFlash({ tokenId: row.id, kind: 'duplicate' });
      return;
    }
    await api.checkIn(row.id);
    setFlash({ tokenId: row.id, kind: 'verified' });
    setQuery('');
    await refresh();
  };

  const submitSearch = () => {
    if (results.length === 1) verify(results[0]);
  };

  return (
    <>
      <div className="print:hidden grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 max-w-[1400px]">
        {/* ---------- Left: verify + selected token ---------- */}
        <div className="flex flex-col gap-5 min-w-0">
          <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <Icon name="keyboard" className="text-primary text-[22px]" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Verify arrival</h2>
              </div>
              <span className={`flex items-center gap-1.5 font-label-sm text-label-sm ${connected ? 'text-tertiary' : 'text-outline'}`}>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-tertiary' : 'bg-outline'}`} />
                {connected ? 'Live' : 'Reconnecting…'}
              </span>
            </div>
            <form
              className="flex flex-col sm:flex-row gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <div className="sm:flex-1 flex items-center gap-2 bg-surface-container-low rounded-xl px-4 h-14 shrink-0 focus-within:ring-2 focus-within:ring-primary/30">
                <Icon name="dialpad" className="text-on-surface-variant text-[22px]" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setFlash(null);
                  }}
                  placeholder="Token # (e.g. 12), phone or name"
                  className="flex-1 min-w-0 bg-transparent font-headline-sm text-headline-sm focus:outline-none placeholder:text-outline-variant placeholder:font-body-lg placeholder:text-body-lg"
                />
              </div>
              <button
                disabled={results.length !== 1}
                className="h-14 px-6 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Icon name="how_to_reg" className="text-[20px]" />
                Verify token
              </button>
            </form>

            {query.trim() && (
              <div className="mt-3 flex flex-col gap-2">
                {results.length === 0 && (
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    No token today matches “{query}”. New patient? Use <strong>Add walk-in</strong>.
                  </p>
                )}
                {results.length > 1 && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {results.length} matches{multiDoctor ? ' — token numbers are per doctor' : ''}. Pick one:
                  </p>
                )}
                {results.length > 1 &&
                  results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => verify(r)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-left"
                    >
                      <span className="font-headline-sm text-headline-sm text-primary w-12">#{r.token_number}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-label-lg text-label-lg truncate">{r.patient?.name ?? 'Patient'}</span>
                        <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">{r.doctor.name}</span>
                      </span>
                      <StatusPill status={r.status} />
                    </button>
                  ))}
              </div>
            )}
          </section>

          {selected ? (
            <TokenPanel
              key={selected.id}
              row={selected}
              tenant={tenant}
              payConfig={payConfig}
              flash={flash?.tokenId === selected.id ? flash.kind : null}
              onVerify={() => verify(selected)}
              onChanged={refresh}
              onClose={() => {
                setSelectedId(null);
                setFlash(null);
              }}
            />
          ) : (
            <section className="bg-surface-container-low rounded-2xl p-8 flex flex-col items-center text-center gap-2">
              <Icon name="qr_code_scanner" className="text-[40px] text-primary" />
              <p className="font-headline-sm text-headline-sm text-on-surface">Ask for the patient&apos;s token number</p>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                It&apos;s on their phone screen. Type it above (or their phone number) and press Enter to verify them.
              </p>
            </section>
          )}
        </div>

        {/* ---------- Right: live queue ---------- */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4 min-w-0 xl:max-h-[calc(100vh-7rem)] xl:sticky xl:top-20">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Live clinic queue</h2>
            <span className="px-2.5 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm">
              {rows?.length ?? 0} today
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 bg-surface-container-low rounded-xl p-3 text-center">
            {[
              ['Verified', stats.verified, 'text-on-surface'],
              ['Waiting', stats.waiting, 'text-primary'],
              ['In cabin', stats.inCabin, 'text-tertiary'],
              ['Not arrived', stats.notArrived, 'text-secondary'],
            ].map(([label, n, cls]) => (
              <div key={label as string}>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
                <p className={`font-headline-md text-headline-md ${cls}`}>{n}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setUnpaidOnly(false)}
              className={`px-3 py-1.5 rounded-full font-label-md text-label-md ${!unpaidOnly ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
            >
              All tokens
            </button>
            <button
              onClick={() => setUnpaidOnly(true)}
              className={`px-3 py-1.5 rounded-full font-label-md text-label-md flex items-center gap-1 ${
                unpaidOnly ? 'bg-secondary text-on-secondary' : 'bg-secondary-fixed text-on-secondary-fixed'
              }`}
            >
              <Icon name="currency_rupee" className="text-[16px]" /> Unpaid · {stats.unpaid}
            </button>
          </div>

          <DoctorShifts shifts={shifts} onChanged={async () => { loadShifts(); await refresh(); }} />

          {multiDoctor && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {[{ id: 'all', name: 'All doctors' }, ...doctors].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDoctorFilter(d.id)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full font-label-md text-label-md ${
                    doctorFilter === d.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}

          {tenant.queue_settings.advance_mode === 'reception' && (
            <ReceptionCallNext
              doctors={doctorFilter === 'all' ? doctors : doctors.filter((d) => d.id === doctorFilter)}
              shifts={shifts}
              onDone={refresh}
            />
          )}

          <div className="flex flex-col gap-2 overflow-y-auto -mx-1 px-1">
            {rows === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
            {rows?.length === 0 && (
              <p className="font-body-md text-body-md text-on-surface-variant py-6 text-center">
                No tokens yet today. Patients appear here as soon as they scan the clinic QR.
              </p>
            )}
            {visible.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedId(r.id);
                  setFlash(null);
                }}
                className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                  r.id === selectedId
                    ? 'bg-primary-fixed/30 ring-2 ring-primary'
                    : r.status === 'done' || r.status === 'no_show'
                      ? 'bg-surface-container-low opacity-60'
                      : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <span className="font-headline-md text-headline-md text-primary w-14 shrink-0">#{r.token_number}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-label-lg text-label-lg text-on-surface truncate">{r.patient?.name ?? 'Patient'}</span>
                  <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">
                    {multiDoctor ? `${r.doctor.name} · ` : ''}
                    {r.visit?.chief_complaint || `joined ${minutesSince(r.joined_at)}m ago`}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 shrink-0">
                  <StatusPill status={r.status} />
                  <PaidBadge row={r} showDue={owes(r, tenant)} />
                </span>
              </button>
            ))}
            {unpaidOnly && visible.length === 0 && rows && rows.length > 0 && (
              <p className="font-body-md text-body-md text-on-surface-variant py-6 text-center">Everyone who owes a fee has paid. 🎉</p>
            )}
          </div>

          <button
            onClick={() => setWalkInOpen(true)}
            className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 mt-auto"
          >
            <Icon name="person_add" className="text-[20px]" />
            Add walk-in
          </button>
        </section>
      </div>

      {walkInOpen && (
        <WalkInDialog
          tenant={tenant}
          doctors={doctors}
          onClose={() => setWalkInOpen(false)}
          onCreated={async (tokenId) => {
            setWalkInOpen(false);
            await refresh();
            setSelectedId(tokenId);
            setFlash({ tokenId, kind: 'verified' });
          }}
        />
      )}

      {selected && VERIFIED.has(selected.status) && <TokenSlip row={selected} tenant={tenant} />}
    </>
  );
}

function TokenPanel({
  row,
  tenant,
  payConfig,
  flash,
  onVerify,
  onChanged,
  onClose,
}: {
  row: QueueRow;
  tenant: Tenant;
  payConfig: PayConfig | null;
  flash: 'verified' | 'duplicate' | null;
  onVerify: () => Promise<void>;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const verified = VERIFIED.has(row.status);
  const settings = tenant.queue_settings;

  return (
    <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
      {flash === 'verified' && (
        <div className="bg-tertiary-container text-on-tertiary px-5 py-3 flex items-center gap-2">
          <Icon name="check_circle" fill className="text-[22px]" />
          <span className="font-label-lg text-label-lg">
            {row.status === 'checked_in_early'
              ? "Verified — arrived before the doctor's session. They'll join the live queue when it starts."
              : 'Verified — patient is now in the waiting queue.'}
          </span>
        </div>
      )}
      {flash === 'duplicate' && (
        <div className="bg-secondary-fixed text-on-secondary-fixed px-5 py-3 flex items-center gap-2">
          <Icon name="warning" className="text-[22px]" />
          <span className="font-label-lg text-label-lg">Already verified — this token was checked in earlier.</span>
        </div>
      )}

      <div className="p-5 flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-center shrink-0">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Token</p>
            <p className="font-display-token text-[44px] leading-[48px] font-extrabold text-primary">#{row.token_number}</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-headline-md text-headline-md text-on-surface">{row.patient?.name ?? 'Patient'}</h3>
              <StatusPill status={row.status} />
              <PaidBadge row={row} />
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {[row.patient?.age ? `${row.patient.age} yrs` : null, row.patient?.gender, row.patient ? `+91 ${row.patient.mobile_number}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="font-label-md text-label-md text-primary mt-1">
              {row.doctor.name}
              {row.doctor.cabin_label ? ` · ${row.doctor.cabin_label}` : ''}
            </p>
            {row.visit?.chief_complaint && (
              <p className="font-body-md text-body-md text-on-surface mt-2">
                <span className="text-on-surface-variant">Reason: </span>
                {row.visit.chief_complaint}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-on-surface-variant hover:text-on-surface">
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>

        {!verified && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onVerify().finally(() => setBusy(false));
            }}
            className="h-14 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Icon name="how_to_reg" className="text-[22px]" />
            {row.status === 'no_show' ? 'Patient is back — verify again' : 'Verify arrival'}
          </button>
        )}

        {row.visit && <VitalsStrip key={row.visit.id} visitId={row.visit.id} initial={row.visit.vitals} onSaved={onChanged} />}

        {row.visit && <PaymentBlock key={row.visit.id} row={row} tenant={tenant} payConfig={payConfig} onChanged={onChanged} />}

        {verified && settings.print_slip_on_checkin && (
          <button
            onClick={() => window.print()}
            className="h-12 rounded-xl bg-surface-container-low text-primary font-label-lg text-label-lg flex items-center justify-center gap-2 hover:bg-surface-container"
          >
            <Icon name="print" className="text-[20px]" />
            Print token slip
          </button>
        )}
      </div>
    </section>
  );
}

/** Decision 5 — collapsible, every field independently optional; only filled fields are saved. */
function VitalsStrip({ visitId, initial, onSaved }: { visitId: string; initial: Vitals | null; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    bp: initial?.bp_systolic ? `${initial.bp_systolic}/${initial.bp_diastolic ?? ''}` : '',
    weight: initial?.weight_kg?.toString() ?? '',
    height: initial?.height_cm?.toString() ?? '',
    temp: initial?.temp_f?.toString() ?? '',
    spo2: initial?.spo2_percent?.toString() ?? '',
  });
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const save = async () => {
    const num = (s: string) => (s.trim() && !Number.isNaN(Number(s)) ? Number(s) : undefined);
    const [sys, dia] = v.bp.split('/').map((x) => num(x ?? ''));
    const vitals: Vitals = {};
    if (sys && dia) Object.assign(vitals, { bp_systolic: sys, bp_diastolic: dia });
    if (num(v.weight)) vitals.weight_kg = num(v.weight);
    if (num(v.height)) vitals.height_cm = num(v.height);
    if (num(v.temp)) vitals.temp_f = num(v.temp);
    if (num(v.spo2)) vitals.spo2_percent = num(v.spo2);
    setState('saving');
    try {
      await api.saveVitals(visitId, vitals);
      setState('saved');
      await onSaved();
    } catch {
      setState('error');
    }
  };

  const fields: [keyof typeof v, string, string][] = [
    ['bp', 'BP', '120/80'],
    ['weight', 'Weight kg', '68'],
    ['height', 'Height cm', '170'],
    ['temp', 'Temp °F', '98.6'],
    ['spo2', 'SpO2 %', '98'],
  ];

  return (
    <div className="bg-surface-container-low rounded-xl">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex items-center gap-2 font-label-lg text-label-lg text-on-surface">
          <Icon name="monitor_heart" className="text-primary text-[20px]" />
          Vitals <span className="font-body-sm text-body-sm text-on-surface-variant">(optional)</span>
        </span>
        <span className="flex items-center gap-2">
          {!open && <VitalsChips vitals={initial} />}
          <Icon name={open ? 'expand_less' : 'expand_more'} className="text-on-surface-variant" />
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {fields.map(([key, label, ph]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
                <input
                  inputMode="decimal"
                  value={v[key]}
                  placeholder={ph}
                  onChange={(e) => {
                    setV((x) => ({ ...x, [key]: e.target.value.replace(/[^\d./]/g, '') }));
                    setState('idle');
                  }}
                  className="h-11 rounded-lg bg-surface-container-lowest px-3 font-label-lg text-label-lg focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-outline-variant placeholder:font-normal"
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={state === 'saving'}
              className="h-10 px-5 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60"
            >
              {state === 'saving' ? 'Saving…' : 'Save vitals'}
            </button>
            {state === 'saved' && <span className="font-label-md text-label-md text-tertiary">Saved ✓</span>}
            {state === 'error' && <span className="font-label-md text-label-md text-error">Couldn&apos;t save — try again</span>}
            <span className="font-body-sm text-body-sm text-on-surface-variant">Leave anything blank that wasn&apos;t measured.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Decision 8 — what reception sees depends on the clinic's payment mode. Decision 9 — never blocks.
 * Decision 10 — shows the patient's own choice (online / cash); every action lands in the payment log.
 */
function PaymentBlock({
  row,
  tenant,
  payConfig,
  onChanged,
}: {
  row: QueueRow;
  tenant: Tenant;
  payConfig: PayConfig | null;
  onChanged: () => Promise<void>;
}) {
  const visit = row.visit!;
  const fee = Number(visit.consultation_fee_inr ?? tenant.queue_settings.default_consultation_fee_inr);
  const [qr, setQr] = useState<PaymentQrView | null>(null);
  const [events, setEvents] = useState<PaymentEvent[] | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reload the history whenever payment state changes (live via the queue socket).
  useEffect(() => {
    if (!showLog) return;
    api.visitPaymentEvents(visit.id).then(setEvents).catch(() => setEvents([]));
  }, [showLog, visit.id, visit.is_paid, visit.payment_choice]);

  useEffect(() => {
    if (visit.is_paid) setQr(null);
  }, [visit.is_paid]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const methodLabel = { cash: 'Cash', upi_counter: 'UPI at counter', upi_online: 'Online (UPI QR)' } as const;
  const choiceLabel = visit.payment_choice === 'online' ? 'Patient chose to pay online' : visit.payment_choice === 'cash' ? 'Patient will pay cash at counter' : "Patient hasn't chosen yet";

  return (
    <div className="rounded-xl bg-surface-container-low overflow-hidden">
      {visit.is_paid ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-tertiary-fixed/30">
          <Icon name="check_circle" fill className="text-tertiary text-[20px]" />
          <p className="flex-1 font-label-lg text-label-lg text-on-tertiary-fixed-variant">
            Paid {inr(visit.consultation_fee_inr)} · {visit.payment_method ? methodLabel[visit.payment_method] : ''}
          </p>
          <button
            disabled={busy}
            onClick={() => {
              const reason = window.prompt('Why undo this payment? (kept in the payment log)');
              if (reason?.trim()) run(() => api.unmarkPaid(visit.id, reason));
            }}
            className="font-label-md text-label-md text-on-surface-variant underline underline-offset-4"
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="px-4 py-3 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-label-lg text-label-lg text-on-secondary-fixed-variant">{inr(fee)} not paid yet</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {tenant.queue_settings.payment_mode === 'pay_after_consultation' && row.status !== 'done'
                  ? 'Collected after the consultation.'
                  : choiceLabel}
              </p>
            </div>
            {visit.payment_choice && (
              <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm whitespace-nowrap">
                {visit.payment_choice === 'online' ? 'Online' : 'Cash'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => run(() => api.markPaid(visit.id, 'cash', fee))} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60">
              Paid · Cash
            </button>
            <button disabled={busy} onClick={() => run(() => api.markPaid(visit.id, 'upi_counter', fee))} className="h-10 px-4 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md disabled:opacity-60">
              Paid · UPI at counter
            </button>
            {payConfig?.online_available && !qr && (
              <button
                disabled={busy}
                onClick={() => run(async () => setQr(await api.staffQr(visit.id)))}
                className="h-10 px-4 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-60"
              >
                <Icon name="qr_code_2" className="text-[18px]" /> Show UPI QR
              </button>
            )}
          </div>
          {qr && <UpiQrCard qr={qr} onChanged={onChanged} />}
        </div>
      )}
      {error && <p className="px-4 pb-3 font-body-sm text-body-sm text-error">{error}</p>}
      <div className="border-t border-surface-container px-4 py-2">
        <button onClick={() => setShowLog((v) => !v)} className="flex items-center gap-1 font-label-md text-label-md text-primary">
          <Icon name={showLog ? 'expand_less' : 'history'} className="text-[18px]" /> {showLog ? 'Hide payment history' : 'Payment history'}
        </button>
        {showLog && <div className="pt-2 pb-1">{events ? <PaymentLog events={events} /> : <p className="font-body-sm text-body-sm">Loading…</p>}</div>}
      </div>
    </div>
  );
}

/**
 * Each doctor's live shift. In "Start shift" clinics reception can start it for the doctor
 * ("Doctor has arrived") — logged with reception's name. Breaks stay the doctor's own action.
 */
function DoctorShifts({ shifts, onChanged }: { shifts: (ShiftView & { doctor_name: string })[]; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (shifts.length === 0) return null;

  const act = async (doctorId: string, fn: () => Promise<unknown>, failMsg: string) => {
    setBusyId(doctorId);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : failMsg);
    } finally {
      setBusyId(null);
    }
  };
  const tone = (s: ShiftView['state']) =>
    s === 'live' ? 'bg-tertiary' : s === 'on_break' ? 'bg-secondary' : 'bg-outline';
  const text = (v: ShiftView) =>
    v.state === 'live'
      ? 'On shift'
      : v.state === 'on_break'
        ? 'On a break'
        : v.state === 'ended'
          ? 'Shift ended'
          : v.mode === 'auto'
            ? v.today_status_detail
            : v.can_delay
              ? v.today_status_detail
              : 'Not started';

  return (
    <div className="flex flex-col gap-1.5">
      {shifts.map((v) => (
        <div key={v.doctor_id} className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${tone(v.state)}`} />
          <span className="flex-1 min-w-0 font-label-md text-label-md truncate">
            {v.doctor_name} <span className="text-on-surface-variant font-normal">· {text(v)}</span>
          </span>
          {v.mode === 'manual' && v.state === 'not_started' && (
            <>
              {v.can_delay && (
                <button
                  disabled={busyId === v.doctor_id}
                  onClick={() => act(v.doctor_id, () => api.delayShift(v.doctor_id), "Couldn't delay the shift.")}
                  className="h-8 px-3 rounded-lg bg-surface-container text-on-surface-variant font-label-sm text-label-sm shrink-0 disabled:opacity-60"
                >
                  Delay 30m
                </button>
              )}
              <button
                disabled={busyId === v.doctor_id}
                onClick={() => act(v.doctor_id, () => api.startShift(v.doctor_id), "Couldn't start the shift.")}
                className="h-8 px-3 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm shrink-0 disabled:opacity-60"
              >
                Doctor has arrived
              </button>
            </>
          )}
        </div>
      ))}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </div>
  );
}

function ReceptionCallNext({
  doctors,
  shifts,
  onDone,
}: {
  doctors: DoctorToday[];
  shifts: ShiftView[];
  onDone: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  return (
    <div className="flex flex-col gap-2 bg-primary-fixed/20 rounded-xl p-3">
      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Reception controls cabin advance</p>
      {doctors.map((d) => {
        const live = shifts.find((s) => s.doctor_id === d.id)?.state === 'live';
        return (
          <div key={d.id} className="flex items-center justify-between gap-2">
            <span className="font-label-md text-label-md truncate">
              {d.name}
              {!live && <span className="text-on-surface-variant font-normal"> · not on shift</span>}
              {note?.id === d.id && <span className="text-on-surface-variant font-normal"> · {note.text}</span>}
            </span>
            <button
              disabled={busyId === d.id || !live}
              onClick={async () => {
                setBusyId(d.id);
                setNote(null);
                try {
                  const next = await api.callNext(d.id);
                  if (!next) setNote({ id: d.id, text: 'nobody waiting / break started' });
                } catch (e) {
                  setNote({ id: d.id, text: e instanceof ApiError ? e.message : 'could not call' });
                } finally {
                  setBusyId(null);
                }
                await onDone();
              }}
              className="h-9 px-3 rounded-lg bg-primary text-on-primary font-label-md text-label-md shrink-0 disabled:opacity-40"
            >
              Call next
            </button>
          </div>
        );
      })}
    </div>
  );
}

function WalkInDialog({
  tenant,
  doctors,
  onClose,
  onCreated,
}: {
  tenant: Tenant;
  doctors: DoctorToday[];
  onClose: () => void;
  onCreated: (tokenId: string) => void;
}) {
  const selectable = doctors.filter((d) => d.today_status !== 'off_today'); // Decision 6
  const [doctorId, setDoctorId] = useState(selectable[0]?.id ?? '');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [age, setAge] = useState('');
  const [complaint, setComplaint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    const digits = mobile.replace(/\D/g, '').slice(-10);
    if (!name.trim() || digits.length !== 10 || !doctorId) {
      setError('Name, a 10-digit mobile number and a doctor are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const patient = await api.findOrCreatePatient({ mobile_number: digits, name: name.trim(), age: age ? Number(age) : null });
      const token = await api.joinQueue({
        tenantId: tenant.id,
        doctorId,
        patientId: patient.id,
        chief_complaint: complaint.trim() || null,
      });
      await api.checkIn(token.id); // walk-in is physically here — verify immediately
      onCreated(token.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the walk-in. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md">Add walk-in</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-on-surface-variant">
            <Icon name="close" />
          </button>
        </div>
        {doctors.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Doctor</span>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none"
            >
              {selectable.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.today_status !== 'available' ? ` — ${d.today_status_detail}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Patient name *</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Mobile *</span>
            <input inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d ]/g, ''))} placeholder="98765 43210" className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Age</span>
            <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))} className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Reason (optional)</span>
          <input value={complaint} onChange={(e) => setComplaint(e.target.value)} className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button disabled={busy || selectable.length === 0} className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg disabled:opacity-60">
          {busy ? 'Adding…' : 'Issue token & verify'}
        </button>
      </form>
    </div>
  );
}

/** Print-only 58/80mm-friendly slip (Decision 2 gates the button that prints it). */
function TokenSlip({ row, tenant }: { row: QueueRow; tenant: Tenant }) {
  return (
    <div className="hidden print:block text-black text-center font-body-md" style={{ width: '72mm', margin: '0 auto' }}>
      <p style={{ fontWeight: 700, fontSize: 16 }}>{tenant.display_name ?? tenant.subdomain}</p>
      <p style={{ fontSize: 12 }}>
        {row.doctor.name}
        {row.doctor.cabin_label ? ` · ${row.doctor.cabin_label}` : ''}
      </p>
      <p style={{ fontSize: 12, marginTop: 8 }}>TOKEN</p>
      <p style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>#{row.token_number}</p>
      <p style={{ fontSize: 14, marginTop: 6 }}>{row.patient?.name}</p>
      <p style={{ fontSize: 11, marginTop: 8 }}>
        {new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
      </p>
      <p style={{ fontSize: 11, marginTop: 4 }}>Please wait to be called · MedQR</p>
    </div>
  );
}
