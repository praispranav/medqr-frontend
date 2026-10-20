'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminApi, VisitInsightsOverview } from '@/lib/adminApi';
import { AdminShell } from '@/components/admin/AdminShell';
import { Icon } from '@/components/patient/ui';

// Owner › Analytics — which clinics and cities actually get visited (page_view_log: doctor profile
// pages, clinic directory pages, and a clinic's own home page). Super admin only.

const DAY_OPTIONS = [7, 30, 90];

export default function AnalyticsPage() {
  return <AdminShell active="/owner/analytics">{(api, me) => (me.role === 'super' || !me.role ? <Analytics api={api} /> : <p className="font-body-md text-body-md">Super admin only.</p>)}</AdminShell>;
}

const n = (v: number) => v.toLocaleString('en-IN');

function Analytics({ api }: { api: AdminApi }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<VisitInsightsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await api.visitInsights(days));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api, days]);
  useEffect(() => {
    load();
  }, [load]);

  const maxClinic = Math.max(1, ...(data?.top_clinics.map((c) => c.count) ?? []));
  const maxCity = Math.max(1, ...(data?.top_cities.map((c) => c.count) ?? []));

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg">Analytics</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            Which clinics and cities actually get visited — doctor pages, clinic pages, and clinics&apos; own home pages. Not search terms (see Search insights for that).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-surface-container-low p-1">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`h-8 px-3 rounded-full font-label-md text-label-md ${days === d ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button onClick={load} disabled={busy} className="h-10 px-4 rounded-full bg-surface-container-low text-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60">
            <Icon name="refresh" className={`text-[18px] ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && <p className="font-body-md text-body-md text-error">{error}</p>}
      {!data && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Total page views" value={n(data.total_views)} />
            <Stat label="Doctor pages" value={n(data.by_kind.doctor_page ?? 0)} />
            <Stat label="Clinic pages" value={n(data.by_kind.clinic_page ?? 0)} />
            <Stat label="Clinic home pages" value={n(data.by_kind.clinic_home ?? 0)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-title-lg text-title-lg font-semibold">Top clinics by visits</h2>
              {data.top_clinics.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No visits logged yet in this window.</p>}
              <div className="flex flex-col gap-2">
                {data.top_clinics.slice(0, 20).map((c) => (
                  <div key={c.tenant_id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-label-md truncate">{c.clinic_name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{c.city ?? '—'} · {c.subdomain}</p>
                    </div>
                    <div className="w-32 h-2 rounded-full bg-surface-container-high overflow-hidden shrink-0">
                      <div className="h-full bg-primary" style={{ width: `${(c.count / maxClinic) * 100}%` }} />
                    </div>
                    <span className="font-label-md text-label-md tabular-nums w-10 text-right shrink-0">{n(c.count)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-title-lg text-title-lg font-semibold">Top cities by visits</h2>
              {data.top_cities.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">No visits logged yet in this window.</p>}
              <div className="flex flex-col gap-2">
                {data.top_cities.slice(0, 20).map((c) => (
                  <div key={c.city} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-label-md truncate">{c.city}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{c.clinic_count} clinic{c.clinic_count === 1 ? '' : 's'} visited</p>
                    </div>
                    <div className="w-32 h-2 rounded-full bg-surface-container-high overflow-hidden shrink-0">
                      <div className="h-full bg-primary" style={{ width: `${(c.count / maxCity) * 100}%` }} />
                    </div>
                    <span className="font-label-md text-label-md tabular-nums w-10 text-right shrink-0">{n(c.count)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4">
      <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="font-headline-sm text-headline-sm font-semibold mt-1">{value}</p>
    </div>
  );
}
