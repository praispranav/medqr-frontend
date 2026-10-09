'use client';

import { useEffect, useState } from 'react';
import { SUPPORT_TOPIC_LABEL, type SupportRequest, type SupportStatus } from '@/lib/api';
import type { AdminApi } from '@/lib/adminApi';
import { AdminShell } from '@/components/admin/AdminShell';

// Decision 37 — the support inbox: Contact-us messages and requests raised by clinic staff.

export default function AdminSupportPage() {
  return <AdminShell active="/owner/support">{(api) => <Inbox api={api} />}</AdminShell>;
}

const STATUS: Record<SupportStatus, { text: string; className: string }> = {
  new: { text: 'New', className: 'bg-primary-container text-on-primary-container' },
  in_progress: { text: 'In progress', className: 'bg-secondary-container text-on-secondary-container' },
  resolved: { text: 'Resolved', className: 'bg-tertiary-container text-white' },
};

function Inbox({ api }: { api: AdminApi }) {
  const [rows, setRows] = useState<SupportRequest[] | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.supportRequests().then(setRows).catch((e: Error) => setError(e.message));
  }, [api]);

  const save = async (id: string, patch: { status?: SupportStatus; reply?: string | null }) => {
    try {
      const updated = await api.updateSupport(id, patch);
      setRows((prev) => prev?.map((r) => (r.id === id ? updated : r)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status !== 'resolved');
  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-headline-lg text-headline-lg">Support</h1>
        <div className="ml-auto flex gap-2">
          {(['open', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`h-9 px-4 rounded-full font-label-md text-label-md ${filter === f ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}>
              {f === 'open' ? 'Open' : 'All'}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      {rows === null && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {rows && shown.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">Nothing here.</p>}
      {shown.map((r) => (
        <Row key={r.id} r={r} onSave={save} />
      ))}
    </div>
  );
}

function Row({ r, onSave }: { r: SupportRequest; onSave: (id: string, patch: { status?: SupportStatus; reply?: string | null }) => Promise<void> }) {
  const [reply, setReply] = useState(r.reply ?? '');
  return (
    <article className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${STATUS[r.status].className}`}>{STATUS[r.status].text}</span>
        <span className="font-label-lg text-label-lg">{r.name}</span>
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          {r.source === 'staff' ? `${r.role} · ${r.clinic_name}` : 'Contact form'} · {SUPPORT_TOPIC_LABEL[r.topic]}
        </span>
        <span className="font-body-sm text-body-sm text-on-surface-variant ml-auto">{new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {[r.mobile && <a key="m" className="text-primary underline" href={`tel:${r.mobile}`}>{r.mobile}</a>, r.email && <a key="e" className="text-primary underline" href={`mailto:${r.email}`}>{r.email}</a>].filter(Boolean).reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, ' · ', x] : [x]), [])}
      </p>
      <p className="font-body-md text-body-md whitespace-pre-wrap">{r.message}</p>
      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={r.source === 'staff' ? 'Reply (shown to them in the app)' : 'Note to yourself'} className="rounded-xl bg-surface-container-low px-3 py-2 font-body-md text-body-md" />
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onSave(r.id, { reply, status: 'in_progress' })} className="h-9 px-4 rounded-lg bg-surface-container-low text-primary font-label-md text-label-md">Save, in progress</button>
        <button onClick={() => onSave(r.id, { reply, status: 'resolved' })} className="h-9 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md">Save, resolved</button>
        {r.status !== 'new' && <button onClick={() => onSave(r.id, { status: 'new' })} className="h-9 px-4 rounded-lg text-on-surface-variant font-label-md text-label-md">Reopen</button>}
      </div>
    </article>
  );
}
