'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminApi, ApiUsageOverview, ApiUsageService, UsageTotals } from '@/lib/adminApi';
import { AdminShell } from '@/components/admin/AdminShell';
import { Icon } from '@/components/patient/ui';

// Decision 73 — what each paid third-party service has been used for, and what is left. Super admin only.
// "Left" comes live from the provider where it has a balance; the counts are our own, kept per day.

export default function ApiUsagePage() {
  return <AdminShell active="/owner/api-usage">{(api, me) => (me.role === 'super' || !me.role ? <Usage api={api} /> : <p className="font-body-md text-body-md">Super admin only.</p>)}</AdminShell>;
}

const n = (v: number) => v.toLocaleString('en-IN');
const money = (v: number) => (v > 0 ? `$${v < 0.01 ? v.toFixed(4) : v.toFixed(2)}` : '—');

function Usage({ api }: { api: AdminApi }) {
  const [data, setData] = useState<ApiUsageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try { setData(await api.apiUsage()); setError(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const low = data?.services.filter((s) => s.live?.low) ?? [];

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg">API usage &amp; credits</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            Every paid service ClinicQ calls, what is left on each account, and how much it was used. These are platform costs — doctors and clinics never see them.
            {data && <> Counting started on {data.tracked_since}; earlier use is not included.</>}
          </p>
        </div>
        <button onClick={load} disabled={busy} className="h-10 px-4 rounded-full bg-surface-container-low text-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60">
          <Icon name="refresh" className={`text-[18px] ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <p className="font-body-md text-body-md text-error">{error}</p>}
      {!data && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {low.length > 0 && (
        <div className="rounded-2xl bg-error-container/60 text-on-error-container p-4 font-body-md text-body-md">
          <b>Top up soon:</b> {low.map((s) => `${s.label} (${s.live?.remaining})`).join(', ')}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data?.services.map((s) => <ServiceCard key={s.key} s={s} />)}
      </div>
    </div>
  );
}

function Stat({ label, t, showCost }: { label: string; t: UsageTotals; showCost: boolean }) {
  return (
    <div>
      <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="font-title-md text-title-md font-semibold">{n(t.calls)} <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">calls</span></p>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {t.errors > 0 && <span className="text-error">{n(t.errors)} failed · </span>}
        {t.units > 0 && <>{n(t.units)} tokens · </>}
        {showCost && money(t.cost_usd) !== '—' && <>{money(t.cost_usd)}</>}
      </p>
    </div>
  );
}

function ServiceCard({ s }: { s: ApiUsageService }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, ...s.daily.map((d) => d.calls));
  const showCost = s.key === 'openrouter';
  return (
    <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-title-lg text-title-lg font-semibold">{s.label}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{s.purpose}</p>
        </div>
        <span className={`px-2 py-1 rounded-full font-label-sm text-label-sm whitespace-nowrap ${s.configured ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}>{s.configured ? 'Connected' : 'Not set up'}</span>
      </div>

      {s.live && (
        <div className={`rounded-xl p-3 ${s.live.low ? 'bg-error-container/60' : 'bg-primary-fixed/40'}`}>
          <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Left on the account</p>
          {s.live.remaining ? <p className="font-headline-sm text-headline-sm font-semibold">{s.live.remaining}{s.live.low && <span className="ml-2 font-label-md text-label-md text-error">low</span>}</p> : null}
          {s.live.detail && <p className="font-body-sm text-body-sm text-on-surface-variant">{s.live.detail}</p>}
          {s.live.error && <p className="font-body-sm text-body-sm text-error">{s.live.error}</p>}
        </div>
      )}
      {!s.live && s.configured && <p className="font-body-sm text-body-sm text-on-surface-variant">No balance to read from this provider — only our own counts are shown.</p>}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Today" t={s.today} showCost={showCost} />
        <Stat label="7 days" t={s.last7} showCost={showCost} />
        <Stat label="30 days" t={s.last30} showCost={showCost} />
      </div>

      <div className="flex items-end gap-1 h-10" aria-label="Calls per day, last 14 days">
        {s.daily.map((d) => <div key={d.day} title={`${d.day}: ${d.calls}`} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${Math.max(d.calls ? 8 : 2, (d.calls / max) * 100)}%`, opacity: d.calls ? 1 : 0.25 }} />)}
      </div>

      {s.operations.length > 0 && (
        <div>
          <button onClick={() => setOpen(!open)} className="text-primary font-label-md text-label-md flex items-center gap-1">
            <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[18px]" /> What it was used for (30 days)
          </button>
          {open && (
            <table className="w-full mt-2 font-body-sm text-body-sm">
              <tbody>
                {s.operations.map((o) => (
                  <tr key={o.operation} className="border-t border-surface-container">
                    <td className="py-1.5 pr-2">{o.operation}</td>
                    <td className="py-1.5 text-right">{n(o.calls)}{o.errors > 0 && <span className="text-error"> ({n(o.errors)} failed)</span>}</td>
                    <td className="py-1.5 text-right text-on-surface-variant">{o.units > 0 ? `${n(o.units)} tok` : ''}{showCost && o.cost_usd > 0 ? ` ${money(o.cost_usd)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
