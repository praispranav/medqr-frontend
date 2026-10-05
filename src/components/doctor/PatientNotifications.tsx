'use client';

import { useState } from 'react';
import { api, ApiError, type DoctorToday, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { inr } from '@/components/staff/bits';

// The automatic WhatsApp updates each doctor's patients get (Decision 12). Per doctor — every doctor
// sets their own, including in a multi-doctor clinic. Each message is paid from the clinic's
// WhatsApp wallet, so the balance is shown right here.

const MESSAGES = [
  { key: 'notify_token_confirmed', title: 'Token confirmed', body: 'When a patient joins your queue — with their token number and a live tracking link.' },
  { key: 'notify_you_are_next', title: '“You are next”', body: 'When they are the next patient, so they come to the cabin.' },
  { key: 'notify_your_turn', title: '“It’s your turn”', body: 'When you call them in.' },
] as const;

type Key = (typeof MESSAGES)[number]['key'];

export function PatientNotifications({
  doctor,
  tenant,
  onSaved,
  save: saveFn = (patch) => api.updateDoctorPublicProfile(doctor.id, patch),
  title = 'Patient Notifications',
}: {
  doctor: DoctorToday;
  tenant: Tenant;
  onSaved: () => Promise<void>;
  save?: (patch: Record<Key, boolean>) => Promise<unknown>;
  title?: string;
}) {
  const initial: Record<Key, boolean> = {
    notify_token_confirmed: doctor.notify_token_confirmed ?? true,
    notify_you_are_next: doctor.notify_you_are_next ?? true,
    notify_your_turn: doctor.notify_your_turn ?? true,
  };
  const [on, setOn] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const dirty = MESSAGES.some((m) => on[m.key] !== initial[m.key]);
  const wallet = Number(tenant.wallet_balance_inr ?? 0);

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      await saveFn(on);
      await onSaved();
      setState('saved');
    } catch (e) {
      setState('idle');
      setError(e instanceof ApiError ? e.message : 'Could not save right now.');
    }
  };

  return (
    <div className="max-w-2xl flex flex-col gap-6 pb-10">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Automatic WhatsApp updates your patients receive about their token.</p>
      </div>

      <div className={`rounded-2xl p-4 flex items-start gap-3 ${wallet < 20 ? 'bg-error-container text-on-error-container' : 'bg-secondary-fixed/40 text-on-secondary-fixed-variant'}`}>
        <Icon name="account_balance_wallet" className="text-[22px] mt-0.5" />
        <p className="font-body-md text-body-md">
          Each message costs <strong>₹0.20</strong> from the clinic&apos;s WhatsApp wallet. Balance: <strong>{inr(wallet)}</strong>
          {wallet < 0.2 ? ' — messages are skipped until it is recharged.' : '.'}
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        {MESSAGES.map((m) => (
          <label key={m.key} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-label-lg text-label-lg">{m.title}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{m.body}</p>
            </div>
            <button
              role="switch"
              aria-checked={on[m.key]}
              onClick={() => setOn((s) => ({ ...s, [m.key]: !s[m.key] }))}
              className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${on[m.key] ? 'bg-primary' : 'bg-surface-container-high'}`}
            >
              <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${on[m.key] ? 'translate-x-6' : ''}`} />
            </button>
          </label>
        ))}
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            disabled={!dirty || state === 'saving'}
            onClick={save}
            className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-40"
          >
            <Icon name="save" className="text-[20px]" />
            {state === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {state === 'saved' && !dirty && <p className="font-body-sm text-body-sm text-tertiary">Saved ✓</p>}
        </div>
      </section>
    </div>
  );
}
