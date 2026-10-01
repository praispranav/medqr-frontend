'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Activity, AdminApi } from '@/lib/adminApi';
import { Icon } from '@/components/patient/ui';
import { AdminShell } from '@/components/admin/AdminShell';
import { minutesSince, StatusPill } from '@/components/staff/bits';

// Platform activity: today's tokens across every clinic, refreshed every 15 s.
export default function AdminActivityPage() {
  return <AdminShell active="/owner">{(api) => <ActivityView api={api} />}</AdminShell>;
}

function ActivityView({ api }: { api: AdminApi }) {
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .activity()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [api]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  if (error && !data) return <p className="font-body-md text-body-md text-error">{error}</p>;
  if (!data) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;

  const t = data.totals;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-headline-lg text-headline-lg">Today across MedQR</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Live — refreshes every 15 seconds.</p>
        </div>
        <Link href="/owner/clinics" className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2">
          <Icon name="add" className="text-[20px]" /> Add clinic
        </Link>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ['Clinics', t.clinics, 'text-on-surface'],
          ['Tokens today', t.tokens_today, 'text-primary'],
          ['Waiting', t.waiting, 'text-secondary'],
          ['In cabin', t.in_consultation, 'text-tertiary'],
          ['Seen', t.done, 'text-on-surface'],
          ['No-shows', t.no_show, 'text-error'],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</p>
            <p className={`font-numeric-metric text-numeric-metric ${cls}`}>{n}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6">
        <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
          <h2 className="font-headline-sm text-headline-sm mb-3">By clinic</h2>
          <div className="flex flex-col divide-y divide-surface-container">
            {data.per_clinic.map((c) => (
              <Link key={c.id} href={`/owner/clinics/${c.id}`} className="py-3 flex items-center gap-3 hover:bg-surface-container-low -mx-2 px-2 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-label-lg text-label-lg truncate">{c.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{c.subdomain}.medqr.in</p>
                </div>
                <div className="text-right font-body-sm text-body-sm text-on-surface-variant">
                  <p><strong className="text-on-surface font-headline-sm text-headline-sm">{c.tokens_today}</strong> tokens</p>
                  <p>{c.done} seen · {c.waiting} waiting</p>
                </div>
                <Icon name="chevron_right" className="text-on-surface-variant" />
              </Link>
            ))}
            {data.per_clinic.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant py-4">No clinics yet.</p>}
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
          <h2 className="font-headline-sm text-headline-sm mb-3">Latest check-ins</h2>
          <div className="flex flex-col gap-2">
            {data.recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
                <span className="font-headline-sm text-headline-sm text-primary w-12 shrink-0">#{r.token_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-label-lg text-label-lg truncate">{r.patient}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {r.clinic} · {r.doctor} · {minutesSince(r.joined_at)}m ago
                  </p>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
            {data.recent.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">No tokens yet today.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
