import type { StaffRole } from '@/lib/api';

/** Where each staff role lands after login (reception and doctors use separate accounts). */
export const HOME_FOR_ROLE: Record<StaffRole, string> = { reception: '/reception', doctor: '/doctor/dashboard', owner: '/manage' };
