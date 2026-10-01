'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { StaffShell } from '@/components/staff/StaffShell';
import { DoctorsTab, LoginsTab, type TeamApi } from '@/components/team/TeamManager';

// Clinic admin — add/remove doctors, set anyone's planned hours, and create reception/doctor logins
// (Decision 14). Owner access itself is granted only by MedQR (platform admin).

export default function ManageTeamPage() {
  return (
    <StaffShell variant="manage" active="/manage/team">
      {({ tenant, me, refreshTenant }) => <Team clinicCode={tenant.subdomain} currentUserId={me.user.id} onDoctorsChanged={refreshTenant} />}
    </StaffShell>
  );
}

function Team({ clinicCode, currentUserId, onDoctorsChanged }: { clinicCode: string; currentUserId: string; onDoctorsChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<'doctors' | 'logins'>('doctors');
  const [pricing, setPricing] = useState<TeamApi['pricing']>();
  useEffect(() => {
    api
      .getBillingCatalog()
      .then((c) => setPricing({ included_doctors: c.included_doctors, extra_doctor_price_inr: c.extra_doctor_price_inr }))
      .catch(() => undefined);
  }, []);
  const team = useMemo<TeamApi>(
    () => ({
      doctors: () => api.manage.doctors(),
      createDoctor: async (b) => {
        const d = await api.manage.createDoctor(b);
        await onDoctorsChanged();
        return d;
      },
      updateDoctor: (id, b) => api.manage.updateDoctor(id, b),
      deleteDoctor: async (id) => {
        await api.manage.deleteDoctor(id);
        await onDoctorsChanged();
      },
      schedule: (doctorId) => ({
        list: (date) => api.listSessions(doctorId, date),
        add: (body) => api.addSession(doctorId, body),
        repeat: (from, days) => api.repeatSessions(doctorId, from, days),
        setActive: (id, active) => api.setSessionActive(doctorId, id, active),
        remove: (id) => api.deleteSession(doctorId, id),
      }),
      users: () => api.manage.users(),
      createUser: (b) =>
        api.manage.createUser({ role: b.role === 'doctor' ? 'doctor' : 'reception', name: b.name, username: b.username, mobile_number: b.mobile_number, doctor_id: b.doctor_id }),
      updateUser: (id, b) => api.manage.updateUser(id, { name: b.name, is_active: b.is_active, password: b.password, mobile_number: b.mobile_number }),
      resetPassword: (id) => api.manage.resetPassword(id),
      deleteUser: (id) => api.manage.deleteUser(id),
      canGrantOwner: false,
      currentUserId,
      pricing,
    }),
    [currentUserId, onDoctorsChanged, pricing],
  );

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Doctors &amp; Staff</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Add doctors, set their hours, and give reception and doctors their own logins.</p>
      </div>
      <div className="flex gap-2">
        {(
          [
            ['doctors', 'Doctors & hours'],
            ['logins', 'Logins'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full font-label-lg text-label-lg ${tab === k ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'doctors' ? <DoctorsTab api={team} /> : <LoginsTab api={team} clinicCode={clinicCode} />}
    </div>
  );
}
