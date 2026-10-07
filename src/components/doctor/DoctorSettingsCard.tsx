'use client';

import { useState } from 'react';
import { Icon } from '@/components/patient/ui';
import { inr } from '@/components/staff/bits';
import type { QueueSettings } from '@/lib/api';
import { DOCTOR_OVERRIDABLE, type DoctorOverridableKey, type DoctorSettingsOverride } from '@/lib/doctorSettings';

// Decision 28 — one doctor's own settings. Every field is either "Same as clinic" (the clinic's
// Queue Rules value, shown greyed) or this doctor's own value. Money + pacing are shown; the rest
// sits under "More". Used by super admin, referrers and the clinic admin (Doctors & Staff).

type Field =
  | { key: DoctorOverridableKey; label: string; kind: 'number'; unit?: string; min: number; max: number }
  | { key: DoctorOverridableKey; label: string; kind: 'select'; options: [string, string][] }
  | { key: DoctorOverridableKey; label: string; kind: 'bool' };

const PAYMENT: [string, string][] = [
  ['cash_at_counter', 'Cash / UPI at counter'],
  ['prepay_remote_only', 'Prepay for remote bookings only'],
  ['prepay_always', 'Prepay always'],
  ['pay_after_consultation', 'Pay after consultation'],
];

const MAIN: Field[] = [
  { key: 'default_consultation_fee_inr', label: 'Consultation fee', kind: 'number', unit: '₹', min: 0, max: 100000 },
  { key: 'payment_mode', label: 'When patients pay', kind: 'select', options: PAYMENT },
  { key: 'offer_online_payment', label: 'Offer online (UPI) payment', kind: 'bool' },
  { key: 'avg_consult_mins', label: 'Average consultation', kind: 'number', unit: 'min', min: 1, max: 120 },
  { key: 'max_daily_tokens', label: 'Max tokens a day', kind: 'number', min: 1, max: 1000 },
  {
    key: 'shift_start_mode',
    label: 'Queue goes live',
    kind: 'select',
    options: [
      ['manual', 'When the doctor taps Start shift'],
      ['auto', 'Automatically at consulting hours'],
    ],
  },
  { key: 'advance_booking_days', label: 'Book ahead (days, 0 = today only)', kind: 'number', min: 0, max: 30 },
];

const MORE: Field[] = [
  {
    key: 'advance_mode',
    label: 'Who calls the next patient',
    kind: 'select',
    options: [
      ['manual', 'Doctor'],
      ['reception', 'Reception only'],
      ['both', 'Both — doctor or reception'],
    ],
  },
  { key: 'no_show_grace_mins', label: 'No-show grace', kind: 'number', unit: 'min', min: 0, max: 120 },
  {
    key: 'no_show_action',
    label: 'If a patient misses their call',
    kind: 'select',
    options: [
      ['skip_to_end', 'Move to the end of the queue'],
      ['push_back', 'Push back a few places'],
      ['notify_and_hold', 'Notify and hold their place'],
    ],
  },
  { key: 'ready_count', label: 'Get next N ready (0 = off)', kind: 'number', min: 0, max: 10 },
];

/** What an unset clinic value means (same fallbacks the server uses). */
const UNSET_MEANS: Partial<Record<DoctorOverridableKey, unknown>> = {
  offer_online_payment: true,
  shift_start_mode: 'manual',
  advance_booking_days: 0,
  advance_mode: 'manual',
};

function show(f: Field, v: unknown) {
  if (v === undefined || v === null) return '—';
  if (f.kind === 'bool') return v ? 'On' : 'Off';
  if (f.kind === 'select') return f.options.find(([k]) => k === v)?.[1] ?? String(v);
  if (f.key === 'default_consultation_fee_inr') return inr(Number(v));
  return `${v}${f.unit && f.unit !== '₹' ? ` ${f.unit}` : ''}`;
}

export function DoctorSettingsCard({
  doctorName,
  clinic,
  override,
  onSave,
}: {
  doctorName: string;
  clinic: QueueSettings;
  override: DoctorSettingsOverride | null | undefined;
  onSave: (patch: Partial<Record<DoctorOverridableKey, unknown>>) => Promise<unknown>;
}) {
  const [own, setOwn] = useState<Partial<Record<DoctorOverridableKey, unknown>>>(() => ({ ...(override ?? {}) }));
  const [more, setMore] = useState(() => MORE.some((f) => override?.[f.key] !== undefined && override?.[f.key] !== null));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ownCount = DOCTOR_OVERRIDABLE.filter((k) => own[k] !== undefined && own[k] !== null).length;

  const row = (f: Field) => {
    const custom = own[f.key] !== undefined && own[f.key] !== null;
    const clinicValue = clinic[f.key as keyof QueueSettings] ?? UNSET_MEANS[f.key];
    const set = (v: unknown) => setOwn((o) => ({ ...o, [f.key]: v }));
    return (
      <div key={f.key} className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-t border-surface-container first:border-0">
        <div className="sm:w-56 shrink-0">
          <p className="font-label-md text-label-md text-on-surface">{f.label}</p>
          {!custom && <p className="font-body-sm text-body-sm text-on-surface-variant">Clinic: {show(f, clinicValue)}</p>}
        </div>
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => set(custom ? null : (clinicValue ?? (f.kind === 'bool' ? true : f.kind === 'number' ? f.min : f.options[0][0])))}
            className={`h-9 px-3 rounded-full font-label-md text-label-md shrink-0 ${custom ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
          >
            {custom ? 'Own setting' : 'Same as clinic'}
          </button>
          {custom && f.kind === 'number' && (
            <div className="flex items-center h-10 rounded-xl bg-surface-container-low px-3 w-36 focus-within:ring-2 focus-within:ring-primary/30">
              {f.unit === '₹' && <span className="text-on-surface-variant mr-1">₹</span>}
              <input
                inputMode="numeric"
                value={String(own[f.key] ?? '')}
                onChange={(e) => set(e.target.value.replace(/\D/g, '') === '' ? '' : Number(e.target.value.replace(/\D/g, '')))}
                className="flex-1 min-w-0 bg-transparent font-body-md text-body-md focus:outline-none"
              />
              {f.unit && f.unit !== '₹' && <span className="text-on-surface-variant ml-1">{f.unit}</span>}
            </div>
          )}
          {custom && f.kind === 'select' && (
            <select value={String(own[f.key])} onChange={(e) => set(e.target.value)} className="h-10 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md">
              {f.options.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          )}
          {custom && f.kind === 'bool' && (
            <button
              onClick={() => set(!own[f.key])}
              className={`h-10 px-4 rounded-xl font-label-md text-label-md ${own[f.key] ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-surface-container text-on-surface-variant'}`}
            >
              {own[f.key] ? 'On' : 'Off'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <Icon name="tune" className="text-[22px] text-primary mt-0.5" />
        <div className="flex-1">
          <h2 className="font-headline-sm text-headline-sm">{doctorName}&apos;s own settings</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Anything left “Same as clinic” follows the clinic’s Queue Rules. {ownCount ? `${ownCount} own setting${ownCount === 1 ? '' : 's'}.` : ''}
          </p>
        </div>
      </div>
      <div className="flex flex-col">{MAIN.map(row)}</div>
      <button onClick={() => setMore((m) => !m)} className="self-start flex items-center gap-1 font-label-md text-label-md text-primary py-1">
        <Icon name={more ? 'expand_less' : 'expand_more'} className="text-[20px]" /> {more ? 'Fewer settings' : 'More settings'}
      </button>
      {more && <div className="flex flex-col">{MORE.map(row)}</div>}
      {msg && <p className={`font-body-sm text-body-sm ${msg.ok ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            // Every key goes up: a value = own setting, null = back to the clinic default.
            const patch = Object.fromEntries(DOCTOR_OVERRIDABLE.map((k) => [k, own[k] === undefined || own[k] === '' ? null : own[k]]));
            await onSave(patch);
            setMsg({ ok: true, text: 'Saved.' });
          } catch (e) {
            setMsg({ ok: false, text: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
        className="h-12 self-start px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </section>
  );
}
