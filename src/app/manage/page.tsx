'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type ManageOverview, type ShiftState } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { inr } from '@/components/staff/bits';
import { getQueueSocket } from '@/lib/socket';

// Clinic admin — "Today" (Decision 14). One row per doctor: shift state, patients, money.
// Read-only: the admin oversees; doctors and reception run the queue. Same screen for a
// 2-doctor clinic and a hospital. No clinical data is shown here.

export default function ManageTodayPage() {
  return (
    <StaffShell variant="manage" active="/manage">
      {({ tenant, doctors }) => <Today clinicName={tenant.display_name ?? tenant.subdomain} doctorIds={doctors.map((d) => d.id)} />}
    </StaffShell>
  );
}

const SHIFT: Record<ShiftState, { label: string; cls: string }> = {
  live: { label: 'On shift', cls: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  on_break: { label: 'On a break', cls: 'bg-secondary-fixed text-on-secondary-fixed' },
  not_started: { label: 'Not started', cls: 'bg-surface-container text-on-surface-variant' },
  ended: { label: 'Shift ended', cls: 'bg-surface-container text-on-surface-variant' },
};

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');

function Today({ clinicName, doctorIds }: { clinicName: string; doctorIds: string[] }) {
  const [data, setData] = useState<ManageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.manage.overview());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Live: every queue/payment change broadcasts on the doctors' rooms; a slow poll covers shift timers.
  const roomKey = doctorIds.join(',');
  useEffect(() => {
    load();
    const socket = getQueueSocket();
    const join = () => roomKey.split(',').filter(Boolean).forEach((id) => socket.emit('join_doctor_room', id));
    join();
    socket.on('connect', join);
    socket.on('queue:changed', load);
    socket.on('session:changed', load);
    const id = setInterval(load, 60_000);
    return () => {
      socket.off('connect', join);
      socket.off('queue:changed', load);
      socket.off('session:changed', load);
      clearInterval(id);
    };
  }, [load, roomKey]);

  const t = data?.totals;

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Today at {clinicName}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Every doctor, live. Money and patient counts update as they happen.</p>
      </div>

      {error && <p className="font-body-md text-body-md text-error">{error}</p>}
      {!data && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}

      {data && t && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Collected', inr(t.collected_inr), 'text-tertiary', `cash ${inr(t.cash_inr)} · UPI ${inr(t.upi_counter_inr + t.online_inr)}`],
              ['Patients', String(t.tokens), 'text-on-surface', `${t.done} seen · ${t.waiting} waiting`],
              ['Doctors on shift', `${t.on_shift} / ${t.doctors}`, 'text-primary', 'right now'],
              ['Not paid yet', String(t.unpaid), t.unpaid ? 'text-secondary' : 'text-on-surface', `${t.no_show} no-show${t.no_show === 1 ? '' : 's'}`],
            ].map(([label, value, cls, sub]) => (
              <div key={label} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</p>
                <p className={`font-numeric-metric text-numeric-metric ${cls}`}>{value}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{sub}</p>
              </div>
            ))}
          </section>

          <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
              <h2 className="font-headline-sm text-headline-sm">Doctors</h2>
              <Link href="/manage/activity" className="font-label-md text-label-md text-primary flex items-center gap-1">
                Activity <Icon name="arrow_forward" className="text-[16px]" />
              </Link>
            </div>
            {data.doctors.length === 0 && (
              <p className="px-5 pb-5 font-body-md text-body-md text-on-surface-variant">
                No doctors yet — add them in <Link href="/manage/team" className="text-primary">Doctors &amp; Staff</Link>.
              </p>
            )}
            {data.doctors.map((d) => {
              const shift = SHIFT[d.shift_state];
              const since =
                d.shift_state === 'on_break' ? `since ${time(d.on_break_since)}` : d.shift_state === 'live' ? `since ${time(d.started_at)}` : d.shift_state === 'ended' ? `at ${time(d.ended_at)}` : d.today_status_detail;
              return (
                <div key={d.doctor_id} className="px-5 py-4 border-t border-surface-container flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-label-lg text-label-lg">{d.doctor_name}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{[d.specialty, d.cabin_label].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="min-w-[150px]">
                    <span className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm ${shift.cls}`}>{shift.label}</span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{since}</p>
                  </div>
                  <div className="min-w-[140px] font-body-md text-body-md">
                    <p>
                      <strong>{d.done}</strong> seen · <strong>{d.waiting}</strong> waiting
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {d.in_cabin ? 'Patient in cabin' : 'Cabin free'}
                      {d.no_show ? ` · ${d.no_show} no-show` : ''}
                    </p>
                  </div>
                  <div className="min-w-[120px] text-right">
                    <p className="font-label-lg text-label-lg">{inr(d.cash_inr + d.upi_counter_inr + d.online_inr)}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{d.unpaid ? `${d.unpaid} unpaid` : 'all paid'}</p>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
