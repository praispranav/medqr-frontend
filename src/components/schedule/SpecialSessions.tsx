'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, type DoctorSession, type SessionType } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { clinicToday } from '@/lib/clinicTime';

/**
 * Decision 40 — Emergency/Night OPD. Doctor opts in by adding one of these; a day with none simply
 * shows nothing special to patients (no separate on/off switch — existence is the toggle, same
 * instinct as the rest of this app). Night sessions may cross midnight (end time before start time).
 */
export function SpecialSessions({ doctorId }: { doctorId: string }) {
  const today = clinicToday();
  const [date, setDate] = useState(today);
  const [sessions, setSessions] = useState<DoctorSession[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<SessionType>('emergency');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (d: string) => {
    setSessions(null);
    const all = await api.listSessions(doctorId, d).catch(() => []);
    setSessions(all.filter((s) => s.session_type !== 'regular' && !s.is_break));
  };

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, doctorId]);

  const crossesMidnight = startsAt && endsAt && endsAt <= startsAt;

  const submit = async () => {
    setError(null);
    if (!/^\d{2}:\d{2}$/.test(startsAt) || !/^\d{2}:\d{2}$/.test(endsAt)) {
      setError('Enter both times');
      return;
    }
    setBusy(true);
    try {
      await api.addSession(doctorId, {
        session_date: date,
        starts_at: startsAt,
        ends_at: endsAt,
        is_break: false,
        session_type: type,
        fee_override_inr: fee.trim() ? Number(fee) : null,
      });
      setAdding(false);
      setStartsAt('');
      setEndsAt('');
      setFee('');
      await load(date);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't add it — try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await api.removeSession(doctorId, id).catch(() => undefined);
    await load(date);
  };

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Emergency / Night OPD</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Only shows to patients on a day you've actually added one — with its own fee if you set one. Night OPD can cross
          midnight (e.g. 10 PM–2 AM).
        </p>
      </div>

      <input
        type="date"
        value={date}
        min={today}
        onChange={(e) => setDate(e.target.value)}
        className="h-11 rounded-xl bg-surface-container px-3 font-body-md text-body-md self-start"
      />

      <div className="flex flex-col gap-2">
        {sessions === null && <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>}
        {sessions?.length === 0 && !adding && <p className="font-body-sm text-body-sm text-on-surface-variant">None for this day.</p>}
        {sessions?.map((s) => (
          <div key={s.id} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-3 py-2.5">
            <Icon name={s.session_type === 'emergency' ? 'emergency' : 'bedtime'} className="text-primary text-[20px] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-label-md text-label-md text-on-surface">
                {s.session_type === 'emergency' ? 'Emergency OPD' : 'Night OPD'} · {s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)}
                {s.ends_at <= s.starts_at ? ' (next day)' : ''}
              </p>
              {s.fee_override_inr != null && <p className="font-body-sm text-body-sm text-on-surface-variant">₹{s.fee_override_inr} consultation fee</p>}
            </div>
            <button onClick={() => remove(s.id)} className="text-error font-label-md text-label-md px-2 h-9" aria-label="Remove">
              <Icon name="delete" className="text-[18px]" />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="flex flex-col gap-3 bg-surface-container-low rounded-xl p-4">
          <div className="flex gap-2">
            {(['emergency', 'night'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className={`flex-1 h-10 rounded-lg font-label-md text-label-md ${type === k ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}`}
              >
                {k === 'emergency' ? 'Emergency' : 'Night'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="time"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              placeholder="Start"
              className="flex-1 h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md"
            />
            <input
              type="time"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              placeholder="End"
              className="flex-1 h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md"
            />
          </div>
          {crossesMidnight && <p className="font-body-sm text-body-sm text-on-surface-variant">Ends the next day.</p>}
          <input
            inputMode="numeric"
            value={fee}
            onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))}
            placeholder="Consultation fee (₹) — optional, defaults to your usual fee"
            className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md"
          />
          {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 h-11 rounded-lg font-label-md text-label-md text-on-surface-variant">
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={submit}
              className="flex-1 h-11 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60"
            >
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="h-11 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center justify-center gap-2"
        >
          <Icon name="add_circle" className="text-[18px]" /> Add Emergency / Night OPD
        </button>
      )}
    </section>
  );
}
