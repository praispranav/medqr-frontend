import type { StaffRole } from '@/lib/api';

/** Where each staff role lands after login (reception and doctors use separate accounts). */
export const HOME_FOR_ROLE: Record<StaffRole, string> = { reception: '/reception', doctor: '/doctor/dashboard', owner: '/manage' };

/** Decision 68: a directory-only clinic (no QR Token System yet) lands on its profile, not an empty queue. */
export function homeFor(me: { user: { role: StaffRole; is_owner?: boolean }; tenant: { qr_enabled?: boolean } }): string {
  if (me.tenant.qr_enabled !== false) return HOME_FOR_ROLE[me.user.role];
  return me.user.role === 'doctor' && !me.user.is_owner ? '/doctor/profile' : me.user.role === 'doctor' ? '/doctor/profile' : '/manage/clinic';
}
