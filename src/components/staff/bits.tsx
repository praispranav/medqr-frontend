'use client';

import type { PaymentMode, QueueRow, TokenStatus, Vitals } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

/** Decision 5 — render only what was recorded; returns null when nothing was. */
export function VitalsChips({ vitals, className = '' }: { vitals: Vitals | null | undefined; className?: string }) {
  if (!vitals) return null;
  const chips: [string, string][] = [];
  if (vitals.bp_systolic && vitals.bp_diastolic) chips.push(['BP', `${vitals.bp_systolic}/${vitals.bp_diastolic}`]);
  if (vitals.weight_kg) chips.push(['Wt', `${vitals.weight_kg} kg`]);
  if (vitals.height_cm) chips.push(['Ht', `${vitals.height_cm} cm`]);
  if (vitals.temp_f) chips.push(['Temp', `${vitals.temp_f}°F`]);
  if (vitals.spo2_percent) chips.push(['SpO2', `${vitals.spo2_percent}%`]);
  if (chips.length === 0) return null;

  // Ensure no duplicates are rendered (e.g. if React StrictMode or data shape causes unexpected repetition)
  const uniqueChips = [];
  const seenKeys = new Set();
  for (const c of chips) {
    if (!seenKeys.has(c[0])) {
      seenKeys.add(c[0]);
      uniqueChips.push(c);
    }
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {uniqueChips.map(([k, v]) => (
        <span key={k} className="px-2.5 py-1 rounded-lg bg-surface-container-lowest font-label-md text-label-md text-on-surface shadow-sm">
          <span className="text-on-surface-variant font-medium">{k}:</span> {v}
        </span>
      ))}
    </div>
  );
}

export const STATUS_LABEL: Record<TokenStatus, string> = {
  booked: 'Not arrived',
  waiting_in_clinic: 'Waiting',
  checked_in_early: 'Arrived early',
  in_consultation: 'In cabin',
  done: 'Done',
  no_show: 'No-show',
};

export function StatusPill({ status }: { status: TokenStatus }) {
  const cls: Record<TokenStatus, string> = {
    booked: 'bg-surface-container text-on-surface-variant',
    waiting_in_clinic: 'bg-primary-fixed/60 text-on-primary-fixed-variant',
    checked_in_early: 'bg-secondary-fixed text-on-secondary-fixed-variant',
    in_consultation: 'bg-primary-container text-on-primary',
    done: 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant',
    no_show: 'bg-error-container text-on-error-container',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm whitespace-nowrap ${cls[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  cash_at_counter: 'Cash / UPI at counter',
  prepay_remote_only: 'Prepay for remote bookings',
  prepay_always: 'Prepay always',
  pay_after_consultation: 'Pay after consultation',
};

export const inr = (n: number | string | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Paid ✓, or "₹500 due" with the patient's choice (online / cash) so reception knows what to expect. */
export function PaidBadge({ row, showDue = false }: { row: Pick<QueueRow, 'visit' | 'status'>; showDue?: boolean }) {
  if (row.visit?.is_paid) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-fixed/60 text-on-tertiary-fixed-variant font-label-sm text-label-sm whitespace-nowrap">
        <Icon name="check_circle" className="text-[14px]" /> Paid
      </span>
    );
  }
  if (!showDue || !row.visit || row.status === 'no_show') return null;
  const choice = row.visit.payment_choice;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm whitespace-nowrap">
      <Icon name="currency_rupee" className="text-[14px]" />
      {inr(row.visit.consultation_fee_inr)} due{choice ? ` · ${choice === 'online' ? 'paying online' : 'cash'}` : ''}
    </span>
  );
}

export function minutesSince(iso: string | null, now = Date.now()) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  const diff = Math.round((now - d) / 60000);
  if (diff > 250 && diff < 400) {
    const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
    // The difference is exactly the server timezone offset, auto-correct it
    const corrected = Math.max(0, Math.round((now - d + tzOffsetMs) / 60000));
    return corrected < 60 ? corrected : diff;
  }
  return Math.max(0, diff);
}
