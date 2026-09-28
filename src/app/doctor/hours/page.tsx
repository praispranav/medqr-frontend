'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type DoctorToday, type Tenant } from '@/lib/api';
import { DoctorStatusRow, Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { ScheduleEditor } from '@/components/schedule/ScheduleEditor';

// Doctor portal — "My Hours". The doctor manages their own consulting sessions and breaks; the
// same data drives the today-only availability chips patients see on Screen #1A (Decision 6).
// One-tap actions cover the common in-clinic moments: step out for a break, come back, stop early.

export default function DoctorHoursPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/hours">
      {({ tenant, doctor }) => <MyHours tenant={tenant} doctor={doctor!} />}
    </StaffShell>
  );
}

function MyHours({ tenant, doctor }: { tenant: Tenant; doctor: DoctorToday }) {
  const [status, setStatus] = useState<Pick<DoctorToday, 'today_status' | 'today_status_detail'>>(doctor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const refreshStatus = useCallback(async () => {
    const list = await api.getDoctorsToday(tenant.id).catch(() => null);
    const me = list?.find((d) => d.id === doctor.id);
    if (me) setStatus(me);
  }, [tenant.id, doctor.id]);

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 60_000); // a break ending on its own flips back to Available
    return () => clearInterval(id);
  }, [refreshStatus]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refreshStatus();
      setEditorKey((k) => k + 1); // reload the day list below
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const s = status.today_status;

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">My consulting hours</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Patients see your status on the check-in screen the moment you change it.
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">What patients see right now</p>
          <button onClick={refreshStatus} className="flex items-center gap-1 font-label-md text-label-md text-primary">
            <Icon name="refresh" className="text-[18px]" /> Refresh
          </button>
        </div>
        <div className="max-w-md">
          <DoctorStatusRow status={s} detail={status.today_status_detail} />
        </div>

        {s === 'available' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <span className="font-label-lg text-label-lg flex items-center gap-2">
              <Icon name="coffee" className="text-secondary text-[20px]" /> Step out for
            </span>
            <div className="flex gap-2">
              {[15, 30, 60].map((m) => (
                <button
                  key={m}
                  disabled={busy}
                  onClick={() => run(() => api.startBreak(doctor.id, m))}
                  className="h-11 px-4 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-lg text-label-lg disabled:opacity-60"
                >
                  {m < 60 ? `${m} min` : '1 hour'}
                </button>
              ))}
            </div>
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm('Stop consulting for today? Patients will see “Sessions ended for today” and can’t pick you.')) {
                  run(() => api.stopForToday(doctor.id));
                }
              }}
              className="sm:ml-auto h-11 px-4 rounded-xl bg-error-container text-on-error-container font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60"
            >
              <Icon name="do_not_disturb_on" className="text-[20px]" /> Stop for today
            </button>
          </div>
        )}

        {s === 'on_break' && (
          <button
            disabled={busy}
            onClick={() => run(() => api.endBreak(doctor.id))}
            className="self-start h-12 px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60"
          >
            <Icon name="login" className="text-[20px]" /> I&apos;m back — resume consulting
          </button>
        )}

        {s === 'starts_later_today' && (
          <p className="font-body-md text-body-md text-on-surface-variant">
            Patients can already join your queue — their token numbers are saved in order until your session starts.
          </p>
        )}

        {s === 'off_today' && (
          <p className="font-body-md text-body-md text-on-surface-variant">
            Patients can&apos;t pick you right now. Add a session for today below to start taking patients.
          </p>
        )}

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      </section>

      <ScheduleEditor
        key={editorKey}
        title={doctor.name}
        onChanged={refreshStatus}
        api={{
          list: (date) => api.listSessions(doctor.id, date),
          add: (body) => api.addSession(doctor.id, body),
          repeat: (from, days) => api.repeatSessions(doctor.id, from, days),
          setActive: (id, active) => api.setSessionActive(doctor.id, id, active),
          remove: (id) => api.deleteSession(doctor.id, id),
        }}
      />
    </div>
  );
}
