'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type PaymentReport, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { inr, STATUS_LABEL } from '@/components/staff/bits';
import { PaymentLog } from '@/components/payments/PaymentLog';
import { getQueueSocket } from '@/lib/socket';
import { clinicToday } from '@/lib/clinicTime';

// One day of payments for the logged-in clinic: totals by method, who still owes, and the full
// append-only log (who marked what, QR created/abandoned/expired, online payments, undo, duplicates).
// Reception sees the whole clinic; the server limits a doctor to their own patients. The clinic
// admin ('owner' scope, Decision 14) also gets a doctor filter, per-doctor totals, the cash
// handover per staff member and a CSV download.

const todayUtc = () => clinicToday(); // clinic (India) date, same as the backend

export function PaymentsReport({
  tenant,
  doctorIds,
  scope,
  doctors = [],
}: {
  tenant: Tenant;
  doctorIds: string[];
  scope: 'clinic' | 'doctor' | 'owner';
  /** owner scope: for the doctor filter. */
  doctors?: { id: string; name: string }[];
}) {
  const [date, setDate] = useState(todayUtc());
  const [doctorId, setDoctorId] = useState('');
  const [report, setReport] = useState<PaymentReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await api.paymentReport(date, scope === 'owner' ? { all: true, doctorId: doctorId || undefined } : {}));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [date, scope, doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live while looking at today: any payment change broadcasts on the doctors' rooms.
  const roomKey = doctorIds.join(',');
  useEffect(() => {
    if (date !== todayUtc()) return;
    const socket = getQueueSocket();
    const join = () => roomKey.split(',').filter(Boolean).forEach((id) => socket.emit('join_doctor_room', id));
    join();
    socket.on('connect', join);
    socket.on('queue:changed', load);
    socket.on('session:changed', load);
    return () => {
      socket.off('connect', join);
      socket.off('queue:changed', load);
      socket.off('session:changed', load);
    };
  }, [date, roomKey, load]);

  const s = report?.summary;
  const collected = s ? s.cash_inr + s.upi_counter_inr + s.online_inr : 0;

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Payments</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {scope === 'doctor' ? 'Your patients' : tenant.display_name ?? tenant.subdomain} · every payment action is logged.
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {scope === 'owner' && doctors.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Doctor</span>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md shadow-sm">
                <option value="">All doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Day</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md shadow-sm" />
          </label>
          {scope === 'owner' && report && (
            <button
              onClick={() => downloadCsv(report, date)}
              className="h-11 px-4 rounded-lg bg-surface-container-lowest shadow-sm text-primary font-label-md text-label-md flex items-center gap-1.5"
            >
              <Icon name="download" className="text-[18px]" /> CSV
            </button>
          )}
        </div>
      </div>

      {error && <p className="font-body-md text-body-md text-error">{error}</p>}
      {!report && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}

      {report && s && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              ['Collected', inr(collected), 'text-tertiary', `${s.paid} of ${s.visits} visits`],
              ['Cash', inr(s.cash_inr), 'text-on-surface', 'at counter'],
              ['UPI at counter', inr(s.upi_counter_inr), 'text-on-surface', "clinic's own UPI"],
              ['Online', inr(s.online_inr), 'text-primary', 'patient paid by QR'],
              ['Still due', inr(s.unpaid_inr), s.unpaid_count ? 'text-secondary' : 'text-on-surface', `${s.unpaid_count} patient${s.unpaid_count === 1 ? '' : 's'}`],
            ].map(([label, value, cls, sub]) => (
              <div key={label} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</p>
                <p className={`font-numeric-metric text-numeric-metric ${cls}`}>{value}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{sub}</p>
              </div>
            ))}
          </section>

          {scope !== 'clinic' && <RazorpayFeeNote />}

          {scope === 'owner' && <OwnerTables report={report} />}

          {s.duplicate_payments > 0 && (
            <p className="bg-error-container text-on-error-container rounded-xl p-4 font-label-lg text-label-lg flex items-center gap-2">
              <Icon name="report" className="text-[22px]" />
              {s.duplicate_payments} patient{s.duplicate_payments === 1 ? '' : 's'} paid twice — refund from the Razorpay dashboard (see the log).
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6">
            <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm self-start">
              <h2 className="font-headline-sm text-headline-sm mb-3">Not paid yet</h2>
              {report.unpaid.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">Nobody owes anything. 🎉</p>}
              <div className="flex flex-col gap-2">
                {report.unpaid.map((u) => (
                  <div key={u.visit_id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
                    <span className="font-headline-sm text-headline-sm text-primary w-12 shrink-0">#{u.token_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-lg text-label-lg truncate">{u.patient_name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {scope !== 'doctor' ? `${u.doctor_name} · ` : ''}
                        {u.token_status ? STATUS_LABEL[u.token_status] : ''}
                        {u.payment_choice ? ` · chose ${u.payment_choice === 'online' ? 'online' : 'cash'}` : ''}
                      </p>
                    </div>
                    <span className="font-label-lg text-label-lg text-secondary">{inr(u.amount_inr)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
              <h2 className="font-headline-sm text-headline-sm mb-3">Payment log</h2>
              <PaymentLog events={report.events} showPatient />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Razorpay deducts its 2% fee + 18% GST on that fee (2.36% total) before settling "Online" (UPI QR)
 * payments to the clinic's bank account — cash and UPI-at-counter aren't touched. Shown to the
 * doctor and clinic admin only (not reception, who never sees settlement) so the number here and
 * the number that actually lands in the bank don't look like a mismatch.
 */
function RazorpayFeeNote() {
  const [open, setOpen] = useState(false);
  const rows = [
    { amount: 1000, fee: 20, gst: 3.6 },
    { amount: 500, fee: 10, gst: 1.8 },
    { amount: 200, fee: 4, gst: 0.72 },
  ];
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2 font-label-lg text-label-lg text-on-surface">
          <Icon name="info" className="text-primary text-[20px]" />
          Online payments settle ~2.36% lower — Razorpay&apos;s fee + GST
        </span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[20px] text-on-surface-variant shrink-0" />
      </button>
      {open && (
        <div className="mt-3">
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
            Razorpay deducts a 2% transaction fee plus 18% GST on that fee before settling an online (UPI QR) payment to your
            bank account. This only applies to the &quot;Online&quot; column above — cash and UPI-at-counter aren&apos;t affected.
          </p>
          <table className="w-full font-body-sm text-body-sm">
            <thead>
              <tr className="text-left font-label-sm text-label-sm text-on-surface-variant uppercase">
                <th className="py-1.5 pr-3">Patient pays</th>
                <th className="py-1.5 pr-3 text-right">Razorpay fee (2%)</th>
                <th className="py-1.5 pr-3 text-right">GST on fee (18%)</th>
                <th className="py-1.5 text-right">You receive</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.amount} className="border-t border-surface-container">
                  <td className="py-1.5 pr-3">{inr(r.amount)}</td>
                  <td className="py-1.5 pr-3 text-right text-on-surface-variant">{inr(r.fee)}</td>
                  <td className="py-1.5 pr-3 text-right text-on-surface-variant">{inr(r.gst)}</td>
                  <td className="py-1.5 text-right font-label-md text-label-md text-tertiary">{inr(r.amount - r.fee - r.gst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Clinic admin: per-doctor collection and the cash handover per staff member (Decision 14). */
function OwnerTables({ report }: { report: PaymentReport }) {
  const rows = report.by_doctor.filter((d) => d.visits > 0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6">
      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm overflow-x-auto">
        <h2 className="font-headline-sm text-headline-sm mb-3">By doctor</h2>
        {rows.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">No visits this day.</p>
        ) : (
          <table className="w-full font-body-md text-body-md">
            <thead>
              <tr className="text-left font-label-sm text-label-sm text-on-surface-variant uppercase">
                <th className="py-2 pr-3">Doctor</th>
                <th className="py-2 pr-3 text-right">Paid</th>
                <th className="py-2 pr-3 text-right">Cash</th>
                <th className="py-2 pr-3 text-right">UPI counter</th>
                <th className="py-2 pr-3 text-right">Online</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.doctor_id} className="border-t border-surface-container">
                  <td className="py-2 pr-3 font-label-lg text-label-lg">{d.doctor_name}</td>
                  <td className="py-2 pr-3 text-right text-on-surface-variant">
                    {d.paid}/{d.visits}
                  </td>
                  <td className="py-2 pr-3 text-right">{inr(d.cash_inr)}</td>
                  <td className="py-2 pr-3 text-right">{inr(d.upi_counter_inr)}</td>
                  <td className="py-2 pr-3 text-right">{inr(d.online_inr)}</td>
                  <td className="py-2 text-right font-label-lg text-label-lg">{inr(d.cash_inr + d.upi_counter_inr + d.online_inr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
        <h2 className="font-headline-sm text-headline-sm">Cash handover</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">What each person marked as collected at the counter.</p>
        {report.collected_by_staff.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">Nothing collected at the counter.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {report.collected_by_staff.map((c) => (
              <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
                <Icon name="person" className="text-[20px] text-on-surface-variant" />
                <span className="flex-1 font-label-lg text-label-lg truncate">{c.name}</span>
                <span className="text-right">
                  <span className="block font-label-lg text-label-lg">{inr(c.cash_inr)} cash</span>
                  {c.upi_counter_inr !== 0 && <span className="block font-body-sm text-body-sm text-on-surface-variant">{inr(c.upi_counter_inr)} UPI</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function downloadCsv(report: PaymentReport, date: string) {
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['Time', 'Token', 'Patient', 'Doctor', 'Event', 'Amount (INR)', 'Method', 'By', 'Note'].map(cell).join(','),
    ...report.events.map((e) =>
      [
        new Date(e.created_at).toLocaleString('en-IN'),
        e.token_number,
        e.patient_name,
        e.doctor_name,
        e.type,
        e.amount_inr ?? '',
        e.method ?? '',
        e.actor_name ?? e.actor_type,
        e.note ?? '',
      ]
        .map(cell)
        .join(','),
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `payments-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
