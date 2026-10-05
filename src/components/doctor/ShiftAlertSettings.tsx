'use client';

import { useState } from 'react';
import { api, ApiError, type DoctorToday } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// Decision 24: WhatsApp alerts to the doctor about their own shift, each with buttons
// [Start shift] [Delay 30 min] [Cancel for today] — and they can just type a reply too.
const MINUTES = [15, 30, 45, 60, 90];

export function ShiftAlertSettings({ doctor, onSaved }: { doctor: DoctorToday; onSaved: () => void }) {
  const initial = {
    before: doctor.shift_alert_before ?? true,
    minutes: doctor.shift_alert_minutes ?? 30,
    atStart: doctor.shift_alert_at_start ?? true,
  };
  const [s, setS] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const dirty = s.before !== initial.before || s.minutes !== initial.minutes || s.atStart !== initial.atStart;

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      await api.updateDoctorPublicProfile(doctor.id, { shift_alert_before: s.before, shift_alert_minutes: s.minutes, shift_alert_at_start: s.atStart });
      onSaved();
      setState('saved');
    } catch (e) {
      setState('idle');
      setError(e instanceof ApiError ? e.message : 'Could not save right now.');
    }
  };

  const toggle = (on: boolean, flip: () => void) => (
    <button
      role="switch"
      aria-checked={on}
      onClick={flip}
      className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${on ? 'bg-primary' : 'bg-surface-container-high'}`}
    >
      <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
    </button>
  );

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Shift alerts on WhatsApp</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Reminders to you, with buttons <strong>Start shift</strong> · <strong>Delay 30 min</strong> · <strong>Cancel for today</strong>. You can also
          just reply, e.g. “running 20 min late”.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p className="font-label-lg text-label-lg">Before my shift</p>
          <div className="flex items-center gap-2 mt-1">
            <select
              disabled={!s.before}
              value={s.minutes}
              onChange={(e) => setS((x) => ({ ...x, minutes: Number(e.target.value) }))}
              className="h-9 rounded-lg bg-surface-container-low px-2 font-body-md text-body-md disabled:opacity-40"
            >
              {(MINUTES.includes(s.minutes) ? MINUTES : [...MINUTES, s.minutes].sort((a, b) => a - b)).map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
            <span className="font-body-sm text-body-sm text-on-surface-variant">before it starts</span>
          </div>
        </div>
        {toggle(s.before, () => setS((x) => ({ ...x, before: !x.before })))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-label-lg text-label-lg">When my shift time arrives</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">If I haven&apos;t tapped Start shift yet.</p>
        </div>
        {toggle(s.atStart, () => setS((x) => ({ ...x, atStart: !x.atStart })))}
      </div>
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
  );
}
