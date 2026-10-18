'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminApi, ChangeRequestView } from '@/lib/adminApi';
import { AdminShell } from '@/components/admin/AdminShell';

// Decision 67 — clinic edits the content check held back (doubtful text, doctor name changes).
// Apply saves exactly what the clinic sent; Reject drops it.

const WHAT = { clinic_profile: 'Clinic page', doctor_profile: 'Doctor profile', doctor: 'Doctor details' } as const;

export default function ChangeRequestsPage() {
  return <AdminShell active="/owner/change-requests">{(api) => <ChangeRequests api={api} />}</AdminShell>;
}

function ChangeRequests({ api }: { api: AdminApi }) {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<ChangeRequestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    api.changeRequests(status).then(setRows).catch((e: Error) => setError(e.message));
  }, [api, status]);

  const decide = async (r: ChangeRequestView, apply: boolean) => {
    if (!window.confirm(apply ? 'Apply this change to the live page?' : 'Reject this change?')) return;
    try {
      await api.decideChangeRequest(r.id, apply);
      setRows((x) => (x ?? []).filter((y) => y.id !== r.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-md text-headline-md">Change requests</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Clinic edits held for a check — doctor name changes, or text the AI wasn&apos;t sure about. Small clean fixes go live on their own.</p>
      </div>
      <div className="flex gap-1 bg-surface-container-low rounded-xl p-1 self-start">
        {(['pending', 'applied', 'rejected', 'all'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`h-9 px-4 rounded-lg font-label-md text-label-md capitalize ${status === s ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>
            {s === 'pending' ? 'To review' : s}
          </button>
        ))}
      </div>
      {error && <p className="text-error">{error}</p>}
      {rows === null && !error && <p className="text-on-surface-variant">Loading…</p>}
      {rows?.length === 0 && <p className="text-on-surface-variant">Nothing here.</p>}
      {rows?.map((r) => (
        <article key={r.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm">{WHAT[r.target]}</span>
            <Link href={`/owner/clinics/${r.tenant_id}`} className="font-label-lg text-label-lg text-primary">{r.clinic_name}</Link>
            {r.doctor_name && <span className="text-on-surface-variant">· {r.doctor_name}</span>}
            <span className="ml-auto font-body-sm text-body-sm text-on-surface-variant">{r.requested_by ? `${r.requested_by} · ` : ''}{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
          <p className="font-body-md text-body-md"><strong>Why held:</strong> {r.reason}</p>
          <dl className="rounded-xl bg-surface-container-low p-3 flex flex-col gap-1.5 font-body-sm text-body-sm">
            {Object.entries(r.patch).filter(([, v]) => typeof v === 'string' || Array.isArray(v)).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-on-surface-variant shrink-0 w-32">{k.replace(/_/g, ' ')}</dt>
                <dd className="break-words whitespace-pre-wrap">{Array.isArray(v) ? v.join(' · ') : String(v)}</dd>
              </div>
            ))}
          </dl>
          {r.status === 'pending' && (
            <div className="flex gap-2">
              <button onClick={() => decide(r, true)} className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md">Apply</button>
              <button onClick={() => decide(r, false)} className="h-10 px-4 rounded-xl bg-surface-container text-error font-label-md text-label-md">Reject</button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
