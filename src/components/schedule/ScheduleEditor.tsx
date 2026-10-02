'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DoctorSession } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { WeeklyEditor } from './WeeklyEditor';

// Day-by-day consulting hours editor, shared by the platform admin (/owner/clinics/[id]) and the
// doctor's own "My Hours" screen (/doctor/hours). Sessions drive the today-only availability
// chips patients see (Decision 6). Callers pass an adapter so each side hits its own API.

export interface ScheduleApi {
  list: (date: string) => Promise<DoctorSession[]>;
  add: (body: { session_date: string; starts_at: string; ends_at: string; is_break: boolean }) => Promise<unknown>;
  repeat: (fromDate: string, days: number) => Promise<unknown>;
  applyWeeklyTemplate?: (weeks: number, template: Record<string, { starts_at: string; ends_at: string; is_break: boolean }[]>) => Promise<unknown>;
  setActive: (sessionId: string, active: boolean) => Promise<unknown>;
  remove: (sessionId: string) => Promise<unknown>;
}

// Backend "today" is the UTC date (see QueueService) — keep the default in step with it.
export const todayIso = () => new Date().toISOString().slice(0, 10);
const hm = (t: string) => t.slice(0, 5);
export const displayTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const display = displayTime;

const PRESETS: [string, string, string][] = [
  ['Morning', '09:00', '13:00'],
  ['Evening', '17:00', '20:30'],
  ['All day', '09:00', '21:00'],
];

export function ScheduleEditor({ api, title, onChanged }: { api: ScheduleApi; title: string; onChanged?: () => void }) {
  const [date, setDate] = useState(todayIso());
  const [sessions, setSessions] = useState<DoctorSession[] | null>(null);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('13:00');
  const [isBreak, setIsBreak] = useState(false);
  const [repeatDays, setRepeatDays] = useState(6);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const load = useCallback(async () => {
    setSessions(await api.list(date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    setSessions(null);
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null);
    try {
      await fn();
      await load();
      onChanged?.();
      if (ok) setMsg({ kind: 'ok', text: ok });
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  };

  if (viewMode === 'week' && api.applyWeeklyTemplate) {
    return (
      <WeeklyEditor
        onApply={async (weeks, template) => {
          await api.applyWeeklyTemplate!(weeks, template);
          await load();
          onChanged?.();
        }}
        onCancel={() => setViewMode('day')}
      />
    );
  }

  const isToday = date === todayIso();

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Consulting hours</p>
          <h2 className="font-headline-md text-headline-md">{title}</h2>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Day</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md" />
          </label>
          {api.applyWeeklyTemplate && (
            <button onClick={() => setViewMode('week')} className="mt-5 h-11 px-4 rounded-lg bg-surface-container-low text-primary font-label-md text-label-md">
              Switch to Weekly Setup
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {sessions === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        {sessions?.length === 0 && (
          <p className="bg-surface-container-low rounded-xl p-4 font-body-md text-body-md text-on-surface-variant">
            No sessions {isToday ? 'today' : 'on this day'} — patients see this doctor as <strong>Off today</strong> and can&apos;t pick them.
          </p>
        )}
        {sessions?.map((s) => (
          <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl ${s.is_active ? 'bg-surface-container-low' : 'bg-surface-container-low opacity-60'}`}>
            <Icon name={s.is_break ? 'coffee' : 'schedule'} className={`text-[22px] ${s.is_break ? 'text-secondary' : 'text-primary'}`} />
            <div className="flex-1">
              <p className={`font-label-lg text-label-lg ${s.is_active ? '' : 'line-through'}`}>
                {display(hm(s.starts_at))} – {display(hm(s.ends_at))}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {s.is_break ? 'Break' : 'Consulting'}
                {!s.is_active && ' · cancelled for this day'}
              </p>
            </div>
            <button
              onClick={() => act(() => api.setActive(s.id, !s.is_active))}
              className="h-9 px-3 rounded-lg bg-surface-container-lowest font-label-md text-label-md text-on-surface-variant"
            >
              {s.is_active ? 'Cancel for day' : 'Restore'}
            </button>
            <button onClick={() => act(() => api.remove(s.id))} aria-label="Delete session" className="w-9 h-9 rounded-lg hover:bg-error-container hover:text-error flex items-center justify-center text-on-surface-variant">
              <Icon name="delete" className="text-[18px]" />
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          act(() => api.add({ session_date: date, starts_at: start, ends_at: end, is_break: isBreak }));
        }}
        className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-3"
      >
        <p className="font-label-lg text-label-lg">Add a session</p>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(([label, s, e]) => (
            <button
              type="button"
              key={label}
              onClick={() => {
                setStart(s);
                setEnd(e);
                setIsBreak(false);
              }}
              className="px-3 py-1.5 rounded-full bg-surface-container-lowest font-label-md text-label-md text-primary"
            >
              {label} {display(s)}–{display(e)}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">From</span>
            <input 
              type="time" 
              value={start} 
              onChange={(e) => {
                const val = e.target.value;
                setStart(val);
                if (val) {
                  const [h, m] = val.split(':').map(Number);
                  setEnd(`${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }
              }} 
              className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md" 
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">To</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md" />
          </label>
          <label className="flex items-center gap-2 h-11 font-body-md text-body-md">
            <input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} className="h-4 w-4 accent-primary" />
            It&apos;s a break
          </label>
          <button className="h-11 px-5 rounded-lg bg-primary text-on-primary font-label-md text-label-md">Add</button>
        </div>
      </form>

      {!!sessions?.length && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => act(() => api.repeat(date, repeatDays), `Copied to the next ${repeatDays} days (their old timings were replaced).`)}
            className="h-10 px-4 rounded-lg bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-2"
          >
            <Icon name="content_copy" className="text-[18px]" /> Repeat this day for the next
          </button>
          <select value={repeatDays} onChange={(e) => setRepeatDays(Number(e.target.value))} className="h-10 rounded-lg bg-surface-container-low px-2 font-label-md text-label-md">
            {[1, 6, 13, 29].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'day' : 'days'}
              </option>
            ))}
          </select>
        </div>
      )}

      {msg && <p className={`font-body-sm text-body-sm ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
    </section>
  );
}

