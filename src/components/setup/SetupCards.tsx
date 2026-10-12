'use client';

import { useCallback } from 'react';
import { api, type Me, type SetupTarget } from '@/lib/api';
import type { AdminApi } from '@/lib/adminApi';
import { SetupCard, type SetupAction } from '@/components/setup/SetupCard';

// Decision 47 — the setup checklist in each portal. Same data and look; only where the links go differs.

/** Doctor portal (top of My Queue): the doctor's own items plus the clinic's. */
export function DoctorSetupCard({ me }: { me: Me }) {
  const canManage = me.user.can_manage_clinic;
  const load = useCallback(() => api.setupChecklist(), []);
  const resolve = (target: SetupTarget): SetupAction => {
    switch (target) {
      case 'hours': return { href: '/doctor/hours' };
      case 'profile': return { href: '/doctor/profile' };
      case 'password': return { href: '/change-password' };
      case 'fee': return canManage ? { href: '/doctor/settings' } : null;
      case 'clinic_details': return canManage ? { href: '/doctor/profile' } : null;
      case 'online_payments': return canManage ? { href: '/doctor/online-payments' } : null;
      case 'billing': return canManage ? { href: me.doctor_count <= 1 ? '/doctor/billing' : '/manage/billing' } : null;
    }
  };
  return (
    <SetupCard
      title="Your setup"
      load={load}
      resolve={resolve}
      confirm={async (item) => {
        await api.confirmSetup(item);
        return api.setupChecklist();
      }}
    />
  );
}

/** Clinic admin's Today page: every doctor's progress. Hours / fee are the doctors' to confirm. */
export function ManageSetupCard() {
  const load = useCallback(() => api.setupChecklist(true), []);
  const resolve = (target: SetupTarget): SetupAction => {
    switch (target) {
      case 'clinic_details': return { href: '/manage/clinic' };
      case 'online_payments': return { href: '/manage/online-payments' };
      case 'billing': return { href: '/manage/billing' };
      case 'profile': return { href: '/manage/team' };
      default: return null;
    }
  };
  return <SetupCard title="Clinic setup" load={load} resolve={resolve} />;
}

/** Platform admin and referrer, on the clinic page: can also confirm a doctor's hours / fee while helping them. */
export function AdminSetupCard({ api: admin, tenantId, referrer, goTab }: { api: AdminApi; tenantId: string; referrer: boolean; goTab: (tab: 'doctors' | 'setup' | 'clinic' | 'logins' | 'payments' | 'modules') => void }) {
  const load = useCallback(() => admin.tenantSetup(tenantId), [admin, tenantId]);
  const resolve = (target: SetupTarget): SetupAction => {
    const go = (tab: Parameters<typeof goTab>[0]) => ({ onClick: () => { goTab(tab); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    switch (target) {
      case 'hours':
      case 'profile': return go('doctors');
      case 'fee':
      case 'clinic_details': return go('clinic');
      case 'online_payments': return referrer ? null : go('payments');
      case 'billing': return referrer ? null : go('modules');
      default: return null;
    }
  };
  return (
    <SetupCard
      title="Clinic setup"
      load={load}
      resolve={resolve}
      confirm={async (item, doctorId) => {
        await admin.confirmDoctorSetup(doctorId, item);
        return admin.tenantSetup(tenantId);
      }}
    />
  );
}
