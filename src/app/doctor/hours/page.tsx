'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type DoctorToday, type ShiftView, type Tenant } from '@/lib/api';
import { DoctorStatusRow } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { ScheduleEditor } from '@/components/schedule/ScheduleEditor';
import { ShiftBar } from '@/components/staff/ShiftBar';

// Doctor portal — "My Hours": the PLANNED consulting hours (day by day) that patients see as
// "From 5:00 PM" etc. (Decision 6). Actual shift and breaks are the one-tap ShiftBar — the same
// controls as on the Queue Command Center — so doctors are never asked for break durations.

export default function DoctorHoursPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/hours">
      {({ tenant, doctor, me }) => <MyHours tenant={tenant} doctor={doctor!} canChangeRules={me.user.can_manage_clinic} />}
    </StaffShell>
  );
}

function MyHours({ tenant, doctor, canChangeRules }: { tenant: Tenant; doctor: DoctorToday; canChangeRules: boolean }) {
  const [shift, setShift] = useState<ShiftView | null>(null);

  const refresh = useCallback(async () => {
    setShift(await api.doctorShift(doctor.id).catch(() => null));
  }, [doctor.id]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000); // planned hours starting/ending flip the state on their own
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">My consulting hours</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Plan your hours below. Start/End shift and breaks are one tap — here or on your queue screen.
        </p>
      </div>

      <ShiftBar doctorId={doctor.id} shift={shift} hasPatientInCabin={false} onChanged={setShift} />

      {shift && (
        <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">What patients see right now</p>
          <div className="max-w-md">
            <DoctorStatusRow status={shift.today_status} detail={shift.today_status_detail} />
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {tenant.queue_settings.shift_start_mode === 'auto'
              ? 'Your shift goes live automatically during the hours below'
              : 'Your shift goes live when you tap Start shift'}
            {canChangeRules ? ' (change this in Queue Rules).' : ' (your clinic admin sets this).'}
          </p>
        </section>
      )}

      <ScheduleEditor
        title={doctor.name}
        onChanged={refresh}
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
