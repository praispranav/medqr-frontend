'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, type DoctorSession, type HoursSlot, type HoursWeek } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { addDays, clinicToday } from '@/lib/clinicTime';

// My Hours — seven days at a time (starting today, then the next 7 days, …), every day a row of tap
// chips: "+ Morning", "+ Evening", "+ Other time", "Day off". Changes save the moment you tap.
// Today's row has "Not coming today"; "I'm off on…" clears a date range. A doctor with no hours yet
// gets a 3-question setup instead. "Repeat this week every week" saves the shown week as the
// doctor's regular week, which the server keeps filled ahead (Decision 20).
// Shared by the doctor (/doctor/hours), the clinic admin (/manage/team) and the platform admin.

type Template = Record<string, HoursSlot[]>;

export interface HoursApi {
  week: (from: string) => Promise<HoursWeek>;
  setDay: (date: string, slots: HoursSlot[]) => Promise<unknown>;
  daysOff: (from: string, to: string) => Promise<unknown>;
  getWeeklyTemplate: () => Promise<{ template: Template; weeks: number; applied_until: string | null }>;
  applyWeeklyTemplate: (weeks: number, template: Template) => Promise<unknown>;
}

const WEEKS_AHEAD = 4; // 4 × 7 days from today — the range the regular week is always filled for
// One-tap blocks. A doctor can add as many slots in a day as they like (and any time via "Other time").
const SLOT_PRESETS: { label: string; icon: string; slot: HoursSlot }[] = [
  { label: 'Morning', icon: 'wb_sunny', slot: { starts_at: '09:00', ends_at: '13:00', is_break: false } },
  { label: 'Afternoon', icon: 'light_mode', slot: { starts_at: '14:00', ends_at: '17:00', is_break: false } },
  { label: 'Evening', icon: 'wb_twilight', slot: { starts_at: '17:00', ends_at: '20:00', is_break: false } },
  { label: 'Night', icon: 'bedtime', slot: { starts_at: '21:00', ends_at: '23:00', is_break: false } },
];
// The day rows offer the common three; the first-time setup offers all four.
const PRESETS = SLOT_PRESETS.filter((p) => p.label !== 'Afternoon');
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const time12 = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const toSlot = (s: Pick<DoctorSession, 'starts_at' | 'ends_at' | 'is_break'>): HoursSlot => ({
  starts_at: s.starts_at.slice(0, 5),
  ends_at: s.ends_at.slice(0, 5),
  is_break: s.is_break,
});

export function HoursEditor({ api, title, onChanged, reloadKey }: { api: HoursApi; title?: string; onChanged?: () => void; reloadKey?: unknown }) {
  const [today, setToday] = useState(clinicToday());
  const [offset, setOffset] = useState(0); // weeks from this week
  const [week, setWeek] = useState<HoursWeek | null>(null);
  const [hasRegular, setHasRegular] = useState<boolean | null>(null);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showOff, setShowOff] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);

  // Rolling weeks from today: each block has every weekday exactly once, nothing in the past.
  const from = addDays(today, offset * 7);

  const load = useCallback(async () => {
    const w = await api.week(from);
    setWeek(w);
    if (w.today !== today) setToday(w.today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  useEffect(() => {
    load().catch((e: Error) => setMsg({ kind: 'error', text: e.message }));
  }, [load, reloadKey]);

  useEffect(() => {
    api
      .getWeeklyTemplate()
      .then((t) => setHasRegular(Object.values(t.template ?? {}).some((slots) => slots.some((s) => !s.is_break))))
      .catch(() => setHasRegular(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (date: string | null, fn: () => Promise<unknown>, ok?: string) => {
    setBusyDate(date);
    setMsg(null);
    try {
      await fn();
      await load();
      onChanged?.();
      if (ok) setMsg({ kind: 'ok', text: ok });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : (e as Error).message });
    } finally {
      setBusyDate(null);
    }
  };

  const slotsOf = (date: string) => (week?.days.find((d) => d.date === date)?.sessions ?? []).filter((s) => s.is_active).map(toSlot);
  const saveDay = (date: string, slots: HoursSlot[], ok?: string) => run(date, () => api.setDay(date, slots), ok);

  const repeatWeek = () => {
    if (!week) return;
    const template: Template = {};
    for (const d of week.days) template[String(weekday(d.date))] = slotsOf(d.date);
    if (!Object.values(template).some((slots) => slots.some((s) => !s.is_break))) {
      setMsg({ kind: 'error', text: 'Add your hours to at least one of these days first.' });
      return;
    }
    if (!window.confirm('Use these 7 days as your regular week? From today, every coming week gets the same hours (days you changed one by one are replaced).')) return;
    run(null, () => api.applyWeeklyTemplate(WEEKS_AHEAD, template), 'Done — this is now your regular week. It repeats automatically.').then(() => setHasRegular(true));
  };

  const emptySoFar = week && week.days.every((d) => d.sessions.length === 0);
  const showSetup = hasRegular === false && offset === 0 && emptySoFar && !setupDismissed;

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Consulting hours</p>
          {title && <h2 className="font-headline-md text-headline-md">{title}</h2>}
        </div>
        <button onClick={() => setShowOff((v) => !v)} className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-1.5">
          <Icon name="event_busy" className="text-[18px]" /> I&apos;m off on…
        </button>
      </div>

      {showOff && (
        <DaysOffForm
          today={today}
          onCancel={() => setShowOff(false)}
          onSave={(a, b) =>
            run(null, () => api.daysOff(a, b), a === b ? `Marked ${shortDate(a)} as a day off.` : `Marked ${shortDate(a)} – ${shortDate(b)} as days off.`).then(() => setShowOff(false))
          }
        />
      )}

      {showSetup ? (
        <FirstTimeSetup
          onSkip={() => setSetupDismissed(true)}
          onSave={(template) =>
            run(null, () => api.applyWeeklyTemplate(WEEKS_AHEAD, template), 'Your hours are set. They repeat every week — change any day below.').then(() => setHasRegular(true))
          }
        />
      ) : (
        <>
          {/* Week switcher */}
          <div className="flex items-center gap-2">
            <button
              aria-label="Previous week"
              disabled={offset === 0}
              onClick={() => setOffset((o) => o - 1)}
              className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center disabled:opacity-30"
            >
              <Icon name="chevron_left" className="text-[22px]" />
            </button>
            <div className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar">
              {Array.from({ length: WEEKS_AHEAD }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setOffset(i)}
                  className={`whitespace-nowrap px-3 py-2 rounded-full font-label-md text-label-md ${offset === i ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
                >
                  {i === 0 ? 'Next 7 days' : `${shortDate(addDays(today, i * 7))} – ${shortDate(addDays(today, i * 7 + 6))}`}
                </button>
              ))}
            </div>
            <button
              aria-label="Next week"
              disabled={offset === WEEKS_AHEAD - 1}
              onClick={() => setOffset((o) => o + 1)}
              className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center disabled:opacity-30"
            >
              <Icon name="chevron_right" className="text-[22px]" />
            </button>
          </div>

          {!week ? (
            <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>
          ) : (
            <div className="flex flex-col divide-y divide-surface-container">
              {week.days.map((d) => (
                <DayRow
                  key={d.date}
                  date={d.date}
                  today={today}
                  sessions={d.sessions}
                  off={d.off}
                  busy={busyDate === d.date}
                  onSave={(slots, ok) => saveDay(d.date, slots, ok)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap border-t border-surface-container pt-4">
            <p className="flex-1 min-w-[200px] font-body-sm text-body-sm text-on-surface-variant">
              {hasRegular
                ? 'Your regular week repeats automatically. Changes to a single day only affect that day.'
                : 'Set these 7 days the way you usually work, then make them repeat every week.'}
            </p>
            <button onClick={repeatWeek} className="h-11 px-4 rounded-xl bg-surface-container-low text-primary font-label-lg text-label-lg flex items-center gap-2">
              <Icon name="event_repeat" className="text-[20px]" /> {hasRegular ? 'Make these my regular hours' : 'Repeat every week'}
            </button>
          </div>
        </>
      )}

      {msg && <p className={`font-body-md text-body-md ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
    </section>
  );
}

function DayRow({
  date,
  today,
  sessions,
  off,
  busy,
  onSave,
}: {
  date: string;
  today: string;
  sessions: DoctorSession[];
  /** Deliberately off (marked, or the regular week's day off) — vs. simply not set yet. */
  off: boolean;
  busy: boolean;
  onSave: (slots: HoursSlot[], ok?: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const past = date < today;
  const isToday = date === today;
  const active = sessions.filter((s) => s.is_active).map(toSlot);
  const label = isToday ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : DAY_NAMES[weekday(date)];

  const without = (i: number) => active.filter((_, j) => j !== i);

  return (
    <div className={`py-3 flex flex-col gap-2 ${past ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-28 shrink-0">
          <p className={`font-label-lg text-label-lg ${isToday ? 'text-primary' : 'text-on-surface'}`}>{label}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{shortDate(date)}</p>
        </div>

        <div className="flex-1 min-w-[200px] flex flex-wrap items-center gap-2">
          {active.length === 0 &&
            (off || past ? (
              <span className="px-3 py-1.5 rounded-full bg-surface-container font-label-md text-label-md text-on-surface-variant">Day off</span>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-secondary-fixed/60 text-on-secondary-fixed font-label-md text-label-md flex items-center gap-1">
                <Icon name="schedule" className="text-[16px]" /> No hours yet
              </span>
            ))}
          {active.map((s, i) => (
            <span
              key={`${s.starts_at}-${i}`}
              className={`inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full font-label-md text-label-md ${
                s.is_break ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-primary-fixed/60 text-on-primary-fixed-variant'
              }`}
            >
              <button disabled={past || busy} onClick={() => setEditIdx(i)} className="disabled:cursor-default">
                {s.is_break ? 'Break ' : ''}
                {time12(s.starts_at)} – {time12(s.ends_at)}
              </button>
              {!past && (
                <button
                  disabled={busy}
                  aria-label="Remove"
                  onClick={() => onSave(without(i))}
                  className="w-6 h-6 rounded-full hover:bg-black/10 flex items-center justify-center"
                >
                  <Icon name="close" className="text-[14px]" />
                </button>
              )}
            </span>
          ))}
          {busy && <Icon name="progress_activity" className="text-[18px] animate-spin text-on-surface-variant" />}
        </div>
      </div>

      {!past && (
        <div className="flex flex-wrap gap-1.5 sm:pl-[124px]">
          {PRESETS.filter((p) => !active.some((s) => s.starts_at === p.slot.starts_at && s.ends_at === p.slot.ends_at)).map((p) => (
            <button
              key={p.label}
              disabled={busy}
              onClick={() => onSave([...active, p.slot])}
              className="h-8 px-3 rounded-full bg-surface-container-low text-primary font-label-sm text-label-sm flex items-center gap-1 hover:bg-surface-container"
            >
              <Icon name={p.icon} className="text-[16px]" /> + {p.label} {time12(p.slot.starts_at).replace(':00', '')}–{time12(p.slot.ends_at).replace(':00', '')}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={() => setAdding(true)}
            className="h-8 px-3 rounded-full bg-surface-container-low text-primary font-label-sm text-label-sm flex items-center gap-1 hover:bg-surface-container"
          >
            <Icon name="add" className="text-[16px]" /> Other time
          </button>
          {(active.length > 0 || !off) && (
            <button
              disabled={busy}
              onClick={() => {
                if (!isToday || window.confirm('Not coming today? Patients will see you as off today. Anyone already holding a token today should be told.')) {
                  onSave([], isToday ? 'Marked as not coming today.' : undefined);
                }
              }}
              className="h-8 px-3 rounded-full bg-error-container/50 text-error font-label-sm text-label-sm flex items-center gap-1"
            >
              <Icon name="event_busy" className="text-[16px]" /> {isToday ? 'Not coming today' : 'Day off'}
            </button>
          )}
        </div>
      )}

      {(adding || editIdx !== null) && (
        <TimeForm
          initial={editIdx !== null ? active[editIdx] : { starts_at: '10:00', ends_at: '13:00', is_break: false }}
          submitLabel={editIdx !== null ? 'Save' : 'Add'}
          onCancel={() => {
            setAdding(false);
            setEditIdx(null);
          }}
          onSubmit={(slot) => {
            onSave(editIdx !== null ? [...without(editIdx), slot] : [...active, slot]);
            setAdding(false);
            setEditIdx(null);
          }}
        />
      )}
    </div>
  );
}

function TimeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: HoursSlot;
  submitLabel: string;
  onSubmit: (s: HoursSlot) => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState(initial.starts_at);
  const [end, setEnd] = useState(initial.ends_at);
  const [isBreak, setIsBreak] = useState(initial.is_break);
  const bad = !start || !end || start >= end;
  return (
    <div className="sm:ml-[124px] flex items-end gap-2 flex-wrap bg-surface-container-low rounded-xl p-3">
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">From</span>
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-md text-body-md" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">To</span>
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-md text-body-md" />
      </label>
      <label className="flex items-center gap-1.5 h-10 font-body-sm text-body-sm">
        <input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} className="w-4 h-4 accent-primary" /> Break
      </label>
      <button disabled={bad} onClick={() => onSubmit({ starts_at: start, ends_at: end, is_break: isBreak })} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-40">
        {submitLabel}
      </button>
      <button onClick={onCancel} className="h-10 px-3 font-label-md text-label-md text-on-surface-variant">
        Cancel
      </button>
      {bad && start && end && <p className="w-full font-body-sm text-body-sm text-error">The end time must be after the start time.</p>}
    </div>
  );
}

function DaysOffForm({ today, onSave, onCancel }: { today: string; onSave: (from: string, to: string) => void; onCancel: () => void }) {
  const [from, setFrom] = useState(addDays(today, 1));
  const [to, setTo] = useState(addDays(today, 1));
  return (
    <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-3">
      <p className="font-label-lg text-label-lg">Which days are you off?</p>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">From</span>
          <input
            type="date"
            min={today}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              if (e.target.value > to) setTo(e.target.value);
            }}
            className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-md text-body-md"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">To (same day for one day)</span>
          <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-md text-body-md" />
        </label>
        <button disabled={!from || !to || to < from} onClick={() => onSave(from, to)} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-40">
          Mark as off
        </button>
        <button onClick={onCancel} className="h-10 px-3 font-label-md text-label-md text-on-surface-variant">
          Cancel
        </button>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">Patients won&apos;t be able to book you on these days. Your regular week continues after.</p>
    </div>
  );
}

type SetupSlot = { id: number; label: string; starts_at: string; ends_at: string };

/** Problems with a list of slots (start before end, no overlaps), or null if it's fine. */
function slotProblem(slots: SetupSlot[]): string | null {
  for (const x of slots) if (!x.starts_at || !x.ends_at || x.starts_at >= x.ends_at) return `${x.label || 'A slot'}: the end time must be after the start time.`;
  const sorted = [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].starts_at < sorted[i - 1].ends_at) return `${sorted[i - 1].label || 'A slot'} and ${sorted[i].label || 'another slot'} overlap — change one of the times.`;
  }
  return null;
}

/** Two quick steps for a doctor with no hours yet: which days, and their consulting slots (as many as they need). */
function FirstTimeSetup({ onSave, onSkip }: { onSave: (t: Template) => void; onSkip: () => void }) {
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6]));
  const [slots, setSlots] = useState<SetupSlot[]>([
    { id: 1, label: 'Morning', starts_at: '09:00', ends_at: '13:00' },
    { id: 2, label: 'Evening', starts_at: '17:00', ends_at: '20:00' },
  ]);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const problem = slots.length ? slotProblem(slots) : 'Add at least one consulting time.';
  const valid = days.size > 0 && !problem;

  const add = (label: string, starts_at: string, ends_at: string) =>
    setSlots((xs) => [...xs, { id: Math.max(0, ...xs.map((x) => x.id)) + 1, label, starts_at, ends_at }]);
  const addOther = () => {
    const lastEnd = [...slots].sort((a, b) => a.ends_at.localeCompare(b.ends_at)).pop()?.ends_at ?? '09:00';
    const [h, m] = lastEnd.split(':').map(Number);
    const start = Math.min(h + 1, 22);
    add('Other', `${String(start).padStart(2, '0')}:${String(m).padStart(2, '0')}`, `${String(start + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };
  const update = (id: number, patch: Partial<SetupSlot>) => setSlots((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = () => {
    const daySlots: HoursSlot[] = [...slots]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map(({ starts_at, ends_at }) => ({ starts_at, ends_at, is_break: false }));
    const t: Template = {};
    for (const d of [0, 1, 2, 3, 4, 5, 6]) t[String(d)] = days.has(d) ? daySlots : [];
    onSave(t);
  };

  return (
    <div className="bg-primary-fixed/20 rounded-2xl p-5 flex flex-col gap-5">
      <div>
        <h3 className="font-headline-sm text-headline-sm">Let&apos;s set your usual hours</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Two quick steps. You can change any day later.</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-label-lg text-label-lg">1. Which days do you consult?</p>
        <div className="flex flex-wrap gap-1.5">
          {order.map((d) => (
            <button
              key={d}
              onClick={() =>
                setDays((s) => {
                  const n = new Set(s);
                  if (n.has(d)) n.delete(d);
                  else n.add(d);
                  return n;
                })
              }
              className={`h-10 px-3 rounded-full font-label-md text-label-md ${days.has(d) ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'}`}
            >
              {DAY_NAMES[d].slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-label-lg text-label-lg">2. Your consulting times</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant -mt-1">Add as many as you need — morning, evening, night or any other time.</p>
        {slots.map((x) => (
          <div key={x.id} className="flex items-center gap-2 flex-wrap">
            <input
              value={x.label}
              onChange={(e) => update(x.id, { label: e.target.value.slice(0, 20) })}
              aria-label="Name of this time"
              className="w-24 h-10 rounded-lg bg-transparent px-1 font-label-md text-label-md focus:bg-surface-container-lowest focus:outline-none"
            />
            <input type="time" value={x.starts_at} onChange={(e) => update(x.id, { starts_at: e.target.value })} className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-md text-body-md" />
            <span className="text-on-surface-variant">to</span>
            <input type="time" value={x.ends_at} onChange={(e) => update(x.id, { ends_at: e.target.value })} className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-md text-body-md" />
            <button
              onClick={() => setSlots((xs) => xs.filter((y) => y.id !== x.id))}
              aria-label={`Remove ${x.label}`}
              className="w-9 h-9 rounded-lg hover:bg-error-container hover:text-error flex items-center justify-center text-on-surface-variant"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {SLOT_PRESETS.filter((p) => !slots.some((x) => x.label === p.label)).map((p) => (
            <button
              key={p.label}
              onClick={() => add(p.label, p.slot.starts_at, p.slot.ends_at)}
              className="h-9 px-3 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm flex items-center gap-1"
            >
              <Icon name={p.icon} className="text-[16px]" /> + {p.label} {time12(p.slot.starts_at).replace(':00', '')}–{time12(p.slot.ends_at).replace(':00', '')}
            </button>
          ))}
          <button onClick={addOther} className="h-9 px-3 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm flex items-center gap-1">
            <Icon name="add" className="text-[16px]" /> Another time
          </button>
        </div>
        {problem && slots.length > 0 && <p className="font-body-sm text-body-sm text-error">{problem}</p>}
      </div>

      <div className="flex items-center gap-3">
        <button disabled={!valid} onClick={save} className="h-12 px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40">
          Save my hours
        </button>
        <button onClick={onSkip} className="font-label-md text-label-md text-on-surface-variant">
          I&apos;ll set each day myself
        </button>
      </div>
    </div>
  );
}
