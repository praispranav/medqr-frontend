import type { QueueSettings } from '@/lib/api';

// Decision 28 — per-doctor settings, same rules as backend/src/common/doctor-settings.ts: the
// clinic's Queue Rules are the defaults and a doctor's `settings_override` wins for these keys.
// Read fee / payment / pacing / who-calls through `doctorSettings(tenant, doctor)`, never straight
// from `tenant.queue_settings`, whenever a doctor is involved.

export const DOCTOR_OVERRIDABLE = [
  'default_consultation_fee_inr',
  'payment_mode',
  'offer_online_payment',
  'avg_consult_mins',
  'max_daily_tokens',
  'shift_start_mode',
  'advance_booking_days',
  'advance_mode',
  'no_show_grace_mins',
  'no_show_action',
  'ready_count',
] as const;

export type DoctorOverridableKey = (typeof DOCTOR_OVERRIDABLE)[number];
export type DoctorSettingsOverride = Partial<Pick<QueueSettings, DoctorOverridableKey>>;

export function doctorSettings(
  tenant: { queue_settings: QueueSettings },
  doctor?: { settings_override?: DoctorSettingsOverride | null } | null,
): QueueSettings {
  const o = doctor?.settings_override ?? {};
  const picked = Object.fromEntries(DOCTOR_OVERRIDABLE.filter((k) => o[k] !== undefined && o[k] !== null).map((k) => [k, o[k]]));
  return { ...tenant.queue_settings, ...picked };
}
