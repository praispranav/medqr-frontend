'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type ShiftView } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// Doctor shift controls (dashboard + My Hours): Start shift / End shift and open-ended breaks.
// No durations are ever asked — "Take a break" offers Now / After this patient / After next patient,
// and "End break" resumes. Calling patients is blocked by the server unless the shift is live.

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');

export function ShiftBar({
  doctorId,
  shift,
  hasPatientInCabin,
  onChanged,
}: {
  doctorId: string;
  shift: ShiftView | null;
  hasPatientInCabin: boolean;
  onChanged: (v: ShiftView) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  if (!shift) return null;

  const run = async (fn: () => Promise<ShiftView>) => {
    setBusy(true);
    setError(null);
    setMenu(false);
    try {
      onChanged(await fn());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const s = shift.state;
  const tone =
    s === 'live' ? 'bg-tertiary-fixed/40 text-on-tertiary-fixed-variant' : s === 'on_break' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container text-on-surface-variant';
  const label =
    s === 'live'
      ? `On shift${shift.started_at ? ` since ${time(shift.started_at)}` : ''}`
      : s === 'on_break'
        ? `On a break${shift.on_break_since ? ` since ${time(shift.on_break_since)}` : ''}`
        : s === 'ended'
          ? 'Shift ended for today'
          : shift.mode === 'auto'
            ? `Starts automatically · ${shift.today_status_detail}`
            : shift.planned_start
              ? `Shift not started · planned ${shift.today_status_detail.replace(/^From /, 'from ')}`
              : `Shift not started · ${shift.today_status_detail}`;

  return (
    <section className="bg-surface-container-lowest rounded-2xl px-4 py-3 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-label-md text-label-md ${tone}`}>
          <span className={`w-2 h-2 rounded-full ${s === 'live' ? 'bg-tertiary animate-pulse' : s === 'on_break' ? 'bg-secondary' : 'bg-outline'}`} />
          {label}
        </span>

        {shift.break_after_patients !== null && s === 'live' && (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-fixed/60 text-on-secondary-fixed font-label-md text-label-md">
            <Icon name="coffee" className="text-[16px]" />
            Break {shift.break_after_patients === 0 ? 'after this patient' : 'after the next patient'}
            <button disabled={busy} onClick={() => run(() => api.cancelBreak(doctorId))} className="underline underline-offset-2 font-label-sm text-label-sm">
              Cancel
            </button>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {s === 'not_started' && shift.mode === 'manual' && (
            <>
              <button disabled={busy} onClick={() => run(() => api.startShift(doctorId))} className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60">
                <Icon name="play_arrow" className="text-[22px]" /> Start shift
              </button>
              {shift.can_delay && (
                <button disabled={busy} onClick={() => run(() => api.delayShift(doctorId))} className="h-11 px-4 rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-60">
                  <Icon name="more_time" className="text-[18px]" /> Delay shift 30 mins
                </button>
              )}
            </>
          )}

          {s === 'live' && shift.break_after_patients === null && (
            <div ref={menuRef} className="relative">
              <button disabled={busy} onClick={() => setMenu((m) => !m)} className="h-11 px-4 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60">
                <Icon name="coffee" className="text-[20px]" /> Take a break <Icon name="expand_more" className="text-[18px]" />
              </button>
              {menu && (
                <div className="absolute right-0 top-12 z-40 w-60 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container p-1.5 flex flex-col">
                  <button onClick={() => run(() => api.startBreak(doctorId, 'now'))} className="text-left px-3 py-2.5 rounded-lg hover:bg-surface-container-low font-label-lg text-label-lg">
                    Now
                  </button>
                  <button
                    disabled={!hasPatientInCabin}
                    onClick={() => run(() => api.startBreak(doctorId, 'after_current'))}
                    className="text-left px-3 py-2.5 rounded-lg hover:bg-surface-container-low font-label-lg text-label-lg disabled:opacity-40"
                  >
                    After this patient
                  </button>
                  <button onClick={() => run(() => api.startBreak(doctorId, 'after_next'))} className="text-left px-3 py-2.5 rounded-lg hover:bg-surface-container-low font-label-lg text-label-lg">
                    After the next patient
                  </button>
                </div>
              )}
            </div>
          )}

          {s === 'on_break' && (
            <button disabled={busy} onClick={() => run(() => api.endBreak(doctorId))} className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60">
              <Icon name="play_arrow" className="text-[22px]" /> End break
            </button>
          )}

          {(s === 'live' || s === 'on_break') && (
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm('End your shift for today? The patient in the cabin will be marked done and patients can no longer join.')) {
                  run(() => api.endShift(doctorId));
                }
              }}
              className="h-11 px-4 rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-60"
            >
              <Icon name="stop_circle" className="text-[18px]" /> End shift
            </button>
          )}

          {s === 'ended' && (
            <button disabled={busy} onClick={() => run(() => api.startShift(doctorId))} className="h-11 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-60">
              <Icon name="replay" className="text-[18px]" /> Resume shift
            </button>
          )}
        </div>
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </section>
  );
}
