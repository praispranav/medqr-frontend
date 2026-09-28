'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type PaymentReport, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { inr, STATUS_LABEL } from '@/components/staff/bits';
import { PaymentLog } from '@/components/payments/PaymentLog';
import { getQueueSocket } from '@/lib/socket';

// One day of payments for the logged-in clinic: totals by method, who still owes, and the full
// append-only log (who marked what, QR created/abandoned/expired, online payments, undo, duplicates).
// Reception sees the whole clinic; the server limits a doctor to their own patients.

const todayUtc = () => new Date().toISOString().slice(0, 10); // backend "today" is the UTC date

export function PaymentsReport({ tenant, doctorIds, scope }: { tenant: Tenant; doctorIds: string[]; scope: 'clinic' | 'doctor' }) {
  const [date, setDate] = useState(todayUtc());
  const [report, setReport] = useState<PaymentReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await api.paymentReport(date));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [date]);

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
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Day</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md shadow-sm" />
        </label>
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
                        {scope === 'clinic' ? `${u.doctor_name} · ` : ''}
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
