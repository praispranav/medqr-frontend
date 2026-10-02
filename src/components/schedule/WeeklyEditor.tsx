import { useState } from 'react';
import { Icon } from '@/components/patient/ui';
import { displayTime } from './ScheduleEditor';

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 0, name: 'Sunday' },
];

export function WeeklyEditor({
  onApply,
  onCancel,
}: {
  onApply: (weeks: number, template: Record<string, { starts_at: string; ends_at: string; is_break: boolean }[]>) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [template, setTemplate] = useState<Record<string, { starts_at: string; ends_at: string; is_break: boolean }[]>>({});
  const [activeDay, setActiveDay] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('13:00');
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const activeSlots = template[activeDay] || [];

  const addSlot = () => {
    setTemplate((prev) => ({
      ...prev,
      [activeDay]: [...(prev[activeDay] || []), { starts_at: start, ends_at: end, is_break: false }].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    }));
  };

  const removeSlot = (idx: number) => {
    setTemplate((prev) => {
      const copy = { ...prev };
      copy[activeDay] = copy[activeDay].filter((_, i) => i !== idx);
      return copy;
    });
  };

  const apply = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await onApply(weeks, template);
      setMsg({ kind: 'ok', text: `Weekly template applied for the next ${weeks} weeks.` });
      setTimeout(onCancel, 2000);
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
      setBusy(false);
    }
  };

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-md text-headline-md">Weekly Template</h2>
        <button onClick={onCancel} className="font-label-md text-label-md text-primary">Back to Day View</button>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Set up a standard week, then generate sessions for the coming weeks.
      </p>

      <div className="flex gap-2 flex-wrap">
        {DAYS.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDay(d.id)}
            className={`px-3 py-1.5 rounded-full font-label-md text-label-md ${activeDay === d.id ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}
          >
            {d.name} {template[d.id]?.length ? `(${template[d.id].length})` : ''}
          </button>
        ))}
      </div>

      <div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-3">
        <h3 className="font-label-lg text-label-lg">{DAYS.find((d) => d.id === activeDay)?.name}</h3>
        {activeSlots.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No sessions (Day off)</p>}
        {activeSlots.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <Icon name="schedule" className="text-primary text-[20px]" />
            <span className="font-body-md text-body-md flex-1">
              {displayTime(s.starts_at)} – {displayTime(s.ends_at)}
            </span>
            <button onClick={() => removeSlot(i)} className="text-error w-8 h-8 rounded-lg hover:bg-error-container flex items-center justify-center">
              <Icon name="delete" className="text-[18px]" />
            </button>
          </div>
        ))}
        <div className="flex items-end gap-2 mt-2 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm">From</span>
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
              className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-sm" 
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm">To</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-sm" />
          </label>
          <button onClick={addSlot} className="h-10 px-4 bg-primary text-on-primary rounded-lg font-label-sm">Add</button>
          <button
            onClick={() => {
              const fromMon = template[1] || [];
              setTemplate((prev) => ({ ...prev, [activeDay]: [...fromMon] }));
            }}
            className="h-10 px-4 bg-surface-container-highest text-on-surface rounded-lg font-label-sm ml-auto"
            title="Copy Monday's slots"
          >
            Copy from Mon
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4 border-t border-surface-container pt-4">
        <label className="flex items-center gap-2 font-body-md text-body-md">
          Generate for next:
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="h-10 rounded-lg bg-surface-container-low px-2">
            {[1, 2, 4, 8, 12].map((w) => (
              <option key={w} value={w}>{w} weeks</option>
            ))}
          </select>
        </label>
        <button disabled={busy} onClick={apply} className="h-10 px-6 bg-primary text-on-primary font-label-md rounded-xl ml-auto disabled:opacity-50">
          Apply Template
        </button>
      </div>
      {msg && <p className={`font-body-sm text-body-sm ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
    </section>
  );
}
