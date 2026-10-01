'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ActivityItem } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';

// Clinic admin — one timeline per day (Decision 14): payments, shifts & breaks, patients joining /
// being called, and staff actions (logins, doctors/logins changed, queue rules changed).

export default function ManageActivityPage() {
  return (
    <StaffShell variant="manage" active="/manage/activity">
      {({ doctors }) => <Activity doctors={doctors.map((d) => ({ id: d.id, name: d.name }))} />}
    </StaffShell>
  );
}

const todayUtc = () => new Date().toISOString().slice(0, 10); // backend "today" is the UTC date

const KINDS: { key: ActivityItem['kind']; label: string; icon: string; cls: string }[] = [
  { key: 'payment', label: 'Payments', icon: 'currency_rupee', cls: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  { key: 'shift', label: 'Shifts & breaks', icon: 'schedule', cls: 'bg-primary-fixed/60 text-primary' },
  { key: 'patient', label: 'Patients', icon: 'person', cls: 'bg-surface-container text-on-surface-variant' },
  { key: 'staff', label: 'Staff', icon: 'badge', cls: 'bg-secondary-fixed text-on-secondary-fixed' },
];

function Activity({ doctors }: { doctors: { id: string; name: string }[] }) {
  const [date, setDate] = useState(todayUtc());
  const [doctorId, setDoctorId] = useState('');
  const [hidden, setHidden] = useState<Set<ActivityItem['kind']>>(new Set());
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api.manage.activity(date, doctorId || undefined)).items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [date, doctorId]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const shown = useMemo(() => (items ?? []).filter((i) => !hidden.has(i.kind)), [items, hidden]);
  const kind = (k: ActivityItem['kind']) => KINDS.find((x) => x.key === k)!;

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Activity</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Who did what, and when — across every doctor and the front desk.</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {doctors.length > 1 && (
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
          <button onClick={load} aria-label="Refresh" className="h-11 w-11 rounded-lg bg-surface-container-lowest shadow-sm text-primary flex items-center justify-center">
            <Icon name="refresh" className="text-[20px]" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {KINDS.map((k) => {
          const on = !hidden.has(k.key);
          return (
            <button
              key={k.key}
              onClick={() =>
                setHidden((h) => {
                  const n = new Set(h);
                  if (n.has(k.key)) n.delete(k.key);
                  else n.add(k.key);
                  return n;
                })
              }
              className={`px-3 py-1.5 rounded-full font-label-md text-label-md flex items-center gap-1.5 ${on ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
            >
              <Icon name={k.icon} className="text-[16px]" /> {k.label}
            </button>
          );
        })}
      </div>

      {error && <p className="font-body-md text-body-md text-error">{error}</p>}
      {!items && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {items && shown.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">Nothing happened on this day.</p>}

      {shown.length > 0 && (
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm">
          {shown.map((i, n) => {
            const k = kind(i.kind);
            return (
              <div key={n} className={`px-5 py-3 flex items-start gap-3 ${n ? 'border-t border-surface-container' : ''}`}>
                <span className="w-16 shrink-0 font-label-md text-label-md text-on-surface-variant pt-1.5">
                  {new Date(i.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${k.cls}`}>
                  <Icon name={k.icon} className="text-[18px]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-body-md text-body-md text-on-surface">{i.text}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {[i.by && `by ${i.by}`, !doctorId && i.doctor_name && i.kind !== 'shift' ? i.doctor_name : null, i.note].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
