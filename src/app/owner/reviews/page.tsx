'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminApi, AdminReview } from '@/lib/adminApi';
import { AdminShell } from '@/components/admin/AdminShell';

// Decision 75 — reviews the AI check held (abuse, spam, off-topic, links) wait here; any review can be removed.

export default function ReviewsPage() {
  return <AdminShell active="/owner/reviews">{(api) => <Reviews api={api} />}</AdminShell>;
}

function Reviews({ api }: { api: AdminApi }) {
  const [status, setStatus] = useState('held');
  const [rows, setRows] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    api.reviews(status).then(setRows).catch((e: Error) => setError(e.message));
  }, [api, status]);

  const act = async (r: AdminReview, publish: boolean) => {
    if (!window.confirm(publish ? 'Publish this review?' : 'Remove this review from the clinic page?')) return;
    try {
      await api.setReviewStatus(r.id, publish);
      setRows((x) => (x ?? []).filter((y) => y.id !== r.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-md text-headline-md">Reviews</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Clean reviews go live on their own. Ones the check held wait here.</p>
      </div>
      <div className="flex gap-1 bg-surface-container-low rounded-xl p-1 self-start">
        {(['held', 'published', 'removed'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`h-9 px-4 rounded-lg font-label-md text-label-md capitalize ${status === s ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>
            {s === 'held' ? 'To review' : s}
          </button>
        ))}
      </div>
      {error && <p className="text-error">{error}</p>}
      {rows === null && !error && <p className="text-on-surface-variant">Loading…</p>}
      {rows?.length === 0 && <p className="text-on-surface-variant">Nothing here.</p>}
      {rows?.map((r) => (
        <article key={r.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#F2A900] font-label-lg">{'★'.repeat(r.rating)}<span className="text-outline">{'★'.repeat(5 - r.rating)}</span></span>
            <span className="font-label-md text-label-md">{r.display_name}</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">· {r.mobile}</span>
            <Link href={`/owner/clinics/${r.tenant_id}`} className="font-label-md text-label-md text-primary">{r.clinic_name ?? r.clinic_code}</Link>
            <span className="ml-auto font-body-sm text-body-sm text-on-surface-variant">{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
          {r.text && <p className="font-body-md text-body-md whitespace-pre-wrap break-words">{r.text}</p>}
          {r.hold_reason && <p className="font-body-sm text-body-sm text-on-surface-variant"><strong>Held because:</strong> {r.hold_reason}</p>}
          <div className="flex gap-2">
            {r.status !== 'published' && <button onClick={() => act(r, true)} className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md">Publish</button>}
            {r.status !== 'removed' && <button onClick={() => act(r, false)} className="h-10 px-4 rounded-xl bg-surface-container text-error font-label-md text-label-md">Remove</button>}
          </div>
        </article>
      ))}
    </div>
  );
}
