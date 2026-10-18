'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { SetupItem, SetupTarget, SetupView } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// Decision 47 — the setup checklist card: a percentage of how ready the clinic is, and one row per thing still to do
// (online payments, confirmed consulting hours and fee, profile, address…). Used in the doctor portal, the clinic admin's
// Today page, and the platform admin / referrer clinic page — each passes where its links should go.

export type SetupAction = { href?: string; onClick?: () => void } | null;

interface Props {
  title: string;
  load: () => Promise<SetupView | null>;
  /** Confirm a doctor's hours / fee (the doctor, or a helper in the admin panel). Omit to hide Confirm buttons. */
  confirm?: (item: 'hours' | 'fee' | 'hours_na' | 'fee_na', doctorId: string) => Promise<SetupView | null>;
  /** Where "Set up / Change" goes for this viewer; null = not theirs to change (shown as plain text). */
  resolve: (target: SetupTarget, item: SetupItem) => SetupAction;
  /** Only the doctor's own items are confirmable by the doctor. */
  canConfirm?: (item: SetupItem) => boolean;
}

export function SetupCard({ title, load, confirm, resolve, canConfirm }: Props) {
  const [view, setView] = useState<SetupView | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => load().then((v) => setView(v)).catch(() => undefined), [load]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!view || view.total === 0) return null;
  const complete = view.percent === 100;
  // The progress is always visible; the list of what is left opens only when the header is tapped.
  const expanded = open ?? false;

  const doConfirm = async (item: SetupItem, unavailable = false) => {
    const what = unavailable ? (item.can_mark_unavailable ? (`${item.can_mark_unavailable}_na` as const) : null) : item.confirm;
    if (!confirm || !what || !item.doctor_id) return;
    setBusy(item.key);
    setError(null);
    try {
      const next = await confirm(what, item.doctor_id);
      if (next) setView(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doctorNames = [...new Set(view.items.filter((i) => i.doctor_name).map((i) => i.doctor_name))];
  const groups: { heading: string | null; items: SetupItem[] }[] = [
    { heading: doctorNames.length > 1 || view.items.some((i) => i.scope === 'clinic') ? 'Clinic' : null, items: view.items.filter((i) => i.scope === 'clinic') },
    ...doctorNames.map((name) => ({ heading: doctorNames.length > 1 ? name : 'Doctor', items: view.items.filter((i) => i.doctor_name === name) })),
  ].filter((g) => g.items.length);

  return (
    <section className="mb-3 bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!expanded)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left" aria-expanded={expanded}>
        <div className="relative w-11 h-11 shrink-0">
          <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-surface-container-high" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(view.percent / 100) * 97.4} 97.4`}
              className={complete ? 'stroke-tertiary' : 'stroke-primary'}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-label-sm text-label-sm text-on-surface">{view.percent}%</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-label-lg text-label-lg text-on-surface">
            {title} <span className="font-body-sm text-body-sm text-on-surface-variant">· {complete ? 'all done' : `${view.done} of ${view.total} done`}</span>
          </p>
        </div>
        <Icon name={expanded ? 'expand_less' : 'expand_more'} className="text-[24px] text-on-surface-variant" />
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-surface-container">
          {groups.map((g) => (
            <div key={g.heading ?? 'all'} className="flex flex-col gap-1 pt-3">
              {g.heading && <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{g.heading}</p>}
              {g.items.map((item) => {
                const action = resolve(item.link as SetupTarget, item);
                const mayConfirm = !!item.confirm && !!confirm && (canConfirm ? canConfirm(item) : true);
                return (
                  <div key={item.key} className="flex items-start gap-3 py-2">
                    <Icon name={item.done ? 'check_circle' : 'radio_button_unchecked'} fill={item.done} className={`text-[22px] mt-0.5 ${item.done ? 'text-tertiary' : 'text-outline'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-label-md text-label-md ${item.done ? 'text-on-surface-variant' : 'text-on-surface'}`}>{item.label}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant break-words">
                        {item.value ? <span className="text-on-surface">{item.value}</span> : item.hint}
                        {item.value && !item.done && <span> — {item.hint}</span>}
                      </p>
                    </div>
                    {!item.done && (
                      <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                        {mayConfirm && (
                          <button
                            disabled={busy === item.key}
                            onClick={() => doConfirm(item)}
                            className="h-9 px-3 rounded-full bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60"
                          >
                            {busy === item.key ? '…' : 'Confirm'}
                          </button>
                        )}
                        {/* Decision 65: hours / fee not known (e.g. a directory listing) — stop asking. */}
                        {!!item.can_mark_unavailable && !!confirm && (canConfirm ? canConfirm(item) : true) && (
                          <button
                            disabled={busy === item.key}
                            onClick={() => doConfirm(item, true)}
                            className="h-9 px-3 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md disabled:opacity-60"
                          >
                            Not available
                          </button>
                        )}
                        {action?.href ? (
                          <Link href={action.href} className="h-9 px-3 rounded-full bg-surface-container text-primary font-label-md text-label-md flex items-center">
                            {item.value ? 'Change' : 'Set up'}
                          </Link>
                        ) : action?.onClick ? (
                          <button onClick={action.onClick} className="h-9 px-3 rounded-full bg-surface-container text-primary font-label-md text-label-md">
                            {item.value ? 'Change' : 'Set up'}
                          </button>
                        ) : (
                          !mayConfirm && <span className="font-body-sm text-body-sm text-on-surface-variant self-center">{item.scope === 'doctor' ? 'Doctor to do' : 'Ask the clinic admin'}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        </div>
      )}
    </section>
  );
}
