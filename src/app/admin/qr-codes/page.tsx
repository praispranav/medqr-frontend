'use client';

import { createRef, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { QrCodeView } from '@/lib/api';
import type { AdminApi, AdminDoctor, AdminTenant } from '@/lib/adminApi';
import { Icon } from '@/components/patient/ui';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  downloadPostersPdf,
  PosterArtboard,
  PosterCard,
  posterContentFor,
  POSTER_FORMATS,
  type PosterKind,
} from '@/components/qr/QrPoster';

// Platform admin: standalone QR standees. Creating codes always asks who they're for:
//  - "Unassigned" — printed ahead and handed out; linked later here as clinics/doctors join (or by a
//    doctor scanning it while logged in);
//  - a clinic/hospital — enough on its own (scan opens the clinic's doctor selection); optionally one
//    doctor too (scan goes straight to that doctor's check-in, no doctor selection).

export default function AdminQrCodesPage() {
  return <AdminShell active="/admin/qr-codes">{(api) => <QrCodes api={api} />}</AdminShell>;
}

type Filter = 'all' | 'unassigned' | 'assigned' | 'disabled';

function QrCodes({ api }: { api: AdminApi }) {
  const [codes, setCodes] = useState<QrCodeView[] | null>(null);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [count, setCount] = useState('10');
  const [label, setLabel] = useState('');
  // Who new codes are for: forTenant is required ('unassigned' or a clinic id); forDoctor is optional ('' = whole clinic).
  const [forTenant, setForTenant] = useState('');
  const [forDoctor, setForDoctor] = useState('');
  const [forDoctors, setForDoctors] = useState<AdminDoctor[]>([]);
  useEffect(() => {
    setForDoctor('');
    setForDoctors([]);
    if (forTenant && forTenant !== 'unassigned') api.doctors(forTenant).then(setForDoctors).catch(() => setForDoctors([]));
  }, [api, forTenant]);
  const target: { doctor_id: string | null; tenant_id: string | null } | undefined =
    forTenant === 'unassigned'
      ? { doctor_id: null, tenant_id: null }
      : forTenant && forDoctor
        ? { doctor_id: forDoctor, tenant_id: forTenant }
        : forTenant
          ? { doctor_id: null, tenant_id: forTenant } // doctor optional: whole clinic
          : undefined; // not chosen yet
  const targetName = !target
    ? ''
    : target.doctor_id
      ? (forDoctors.find((d) => d.id === target.doctor_id)?.name ?? 'this doctor')
      : target.tenant_id
        ? `${tenants.find((t) => t.id === target.tenant_id)?.display_name ?? 'the clinic'} (whole clinic)`
        : '';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [batchKind, setBatchKind] = useState<PosterKind>('a5');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([api.qrCodes(), api.tenants()]);
    setCodes(c);
    setTenants(t);
  }, [api]);

  useEffect(() => {
    load().catch((e: Error) => setMsg({ kind: 'error', text: e.message }));
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase().replace(/^MQ-?/, '');
    return (codes ?? []).filter(
      (c) =>
        (filter === 'all' || c.status === filter) &&
        (!q || c.code.includes(q) || c.doctor?.name.toUpperCase().includes(q) || c.clinic?.name.toUpperCase().includes(q) || c.label?.toUpperCase().includes(q)),
    );
  }, [codes, filter, query]);

  const counts = useMemo(() => {
    const c = codes ?? [];
    return { all: c.length, unassigned: c.filter((x) => x.status === 'unassigned').length, assigned: c.filter((x) => x.status === 'assigned').length, disabled: c.filter((x) => x.status === 'disabled').length };
  }, [codes]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      await load();
      setMsg({ kind: 'ok', text: ok });
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  };

  const create = async () => {
    if (!target) return;
    const who = targetName || null;
    const n = Number(count);
    // Codes are permanent, printable assets — never create a batch from a stray Enter key.
    if (!window.confirm(`Create ${n} new QR code${n === 1 ? '' : 's'} ${who ? `for ${who}` : '(unassigned)'}?`)) return;
    setBusy(true);
    await act(async () => {
      const made = await api.createQrCodes(n, label, target);
      setSelected(new Set(made.map((m) => m.id)));
      setFilter(target.tenant_id ? 'assigned' : 'unassigned');
    }, `${n} new QR code${n === 1 ? '' : 's'} ${who ? `for ${who}` : '(unassigned)'} created and selected — download them below.`);
    setBusy(false);
  };

  // Offscreen artboards for multi-page PDF export of the selection.
  const selectedCodes = (codes ?? []).filter((c) => selected.has(c.id));
  const refs = useRef<Map<string, RefObject<HTMLDivElement>>>(new Map());
  const refFor = (id: string) => {
    if (!refs.current.has(id)) refs.current.set(id, createRef<HTMLDivElement>());
    return refs.current.get(id)!;
  };

  const exportSelected = async () => {
    setExporting(true);
    setMsg(null);
    try {
      const nodes = selectedCodes.map((c) => refFor(c.id).current).filter((n): n is HTMLDivElement => !!n);
      await downloadPostersPdf(nodes, batchKind, `medqr-qr-codes-${selectedCodes.length}-${batchKind}.pdf`);
    } catch (e) {
      setMsg({ kind: 'error', text: `Couldn't create the PDF: ${(e as Error).message}` });
    } finally {
      setExporting(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const preview = codes?.find((c) => c.id === previewId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg">QR codes</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Print codes ahead as “Unassigned” and hand them out; as clinics and doctors join, link each printed code here to a whole clinic
          (patients pick the doctor) or to one doctor (straight to their check-in). A doctor can also scan an unassigned code while
          logged in and tap “Link to me”.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3"
      >
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">How many</span>
          <input
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 3))}
            className="h-11 w-24 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Clinic *</span>
          <select value={forTenant} onChange={(e) => setForTenant(e.target.value)} className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md">
            <option value="">Choose…</option>
            <option value="unassigned">Unassigned — print now, link later</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display_name ?? t.subdomain}
              </option>
            ))}
          </select>
        </label>
        {forTenant && forTenant !== 'unassigned' && (
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Doctor (optional)</span>
            <select value={forDoctor} onChange={(e) => setForDoctor(e.target.value)} className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md">
              <option value="">Whole clinic — patient picks the doctor</option>
              {forDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 flex-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Batch note (optional)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Pune onboarding kits — Oct"
            className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md"
          />
        </label>
        <button disabled={busy || !Number(count) || !target} className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-50">
          <Icon name="add" className="text-[20px]" /> {busy ? 'Creating…' : target && !target.tenant_id ? 'Create unassigned QR codes' : 'Create QR codes'}
        </button>
      </form>

      {msg && <p className={`font-body-md text-body-md ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'unassigned', 'assigned', 'disabled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full font-label-md text-label-md capitalize ${filter === f ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
          >
            {f} · {counts[f]}
          </button>
        ))}
        <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl px-3 h-10 ml-auto shadow-sm">
          <Icon name="search" className="text-on-surface-variant text-[18px]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Code, doctor, clinic…" className="bg-transparent font-body-md text-body-md focus:outline-none w-44" />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bg-primary-fixed/30 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
          <p className="font-label-lg text-label-lg">{selected.size} selected</p>
          <select value={batchKind} onChange={(e) => setBatchKind(e.target.value as PosterKind)} className="h-10 rounded-lg bg-surface-container-lowest px-2 font-label-md text-label-md">
            {POSTER_FORMATS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label} ({f.meta})
              </option>
            ))}
          </select>
          <button disabled={exporting} onClick={exportSelected} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md flex items-center gap-2 disabled:opacity-60">
            <Icon name={exporting ? 'progress_activity' : 'picture_as_pdf'} className={`text-[18px] ${exporting ? 'animate-spin' : ''}`} />
            {exporting ? 'Building PDF…' : 'Download as one PDF (1 per page)'}
          </button>
          <button onClick={() => setSelected(new Set())} className="font-label-md text-label-md text-on-surface-variant underline underline-offset-4">
            Clear
          </button>
        </div>
      )}

      <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        {codes === null && <p className="p-5 font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        {codes && visible.length === 0 && <p className="p-5 font-body-md text-body-md text-on-surface-variant">No QR codes here yet.</p>}
        {visible.map((q) => (
          <div key={q.id} className="border-b border-surface-container last:border-0">
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} aria-label={`Select MQ-${q.code}`} className="h-4 w-4 accent-primary" />
              <span className="font-headline-sm text-headline-sm tracking-wider w-32">MQ-{q.code}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${
                  q.status === 'assigned' ? 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant' : q.status === 'disabled' ? 'bg-error-container text-on-error-container' : 'bg-secondary-fixed text-on-secondary-fixed'
                }`}
              >
                {q.status === 'assigned' ? 'Assigned' : q.status === 'disabled' ? 'Disabled' : 'Unassigned'}
              </span>
              <div className="flex-1 min-w-[180px]">
                <p className="font-label-md text-label-md text-on-surface">
                  {q.doctor ? `${q.doctor.name} · ${q.clinic?.name ?? ''}` : q.clinic ? `${q.clinic.name} · whole clinic` : '—'}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {[q.label, q.assigned_by ? `by ${q.assigned_by}` : null, q.scan_count ? `${q.scan_count} scan${q.scan_count === 1 ? '' : 's'}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'Not linked yet'}
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setPreviewId(previewId === q.id ? null : q.id)} className="h-9 px-3 rounded-lg bg-surface-container-low font-label-md text-label-md text-primary flex items-center gap-1">
                  <Icon name="download" className="text-[16px]" /> Poster
                </button>
                {q.status !== 'disabled' && (
                  <button onClick={() => setAssignId(assignId === q.id ? null : q.id)} className="h-9 px-3 rounded-lg bg-surface-container-low font-label-md text-label-md text-primary">
                    {q.clinic ? 'Reassign' : 'Assign'}
                  </button>
                )}
                {q.clinic && (
                  <button onClick={() => act(() => api.updateQrCode(q.id, { doctor_id: null, tenant_id: null }), `MQ-${q.code} is unassigned again.`)} className="h-9 px-3 rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                    Unassign
                  </button>
                )}
                <button
                  onClick={() =>
                    q.status === 'disabled'
                      ? act(() => api.updateQrCode(q.id, { status: 'active' }), `MQ-${q.code} works again.`)
                      : window.confirm(`Disable MQ-${q.code}? Scanning it will stop working.`) && act(() => api.updateQrCode(q.id, { status: 'disabled' }), `MQ-${q.code} disabled.`)
                  }
                  className="h-9 px-3 rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface-variant"
                >
                  {q.status === 'disabled' ? 'Enable' : 'Disable'}
                </button>
              </div>
            </div>
            {assignId === q.id && (
              <AssignRow
                api={api}
                tenants={tenants}
                onAssign={(tenantId, doctorId) =>
                  act(async () => {
                    await api.updateQrCode(q.id, doctorId ? { doctor_id: doctorId } : { tenant_id: tenantId, doctor_id: null });
                    setAssignId(null);
                  }, doctorId ? `MQ-${q.code} linked to the doctor.` : `MQ-${q.code} is now the clinic's shared QR.`)
                }
              />
            )}
            {previewId === q.id && preview && (
              <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {POSTER_FORMATS.map((f) => (
                  <PosterCard key={f.key} kind={f.key} content={posterContentFor(preview)} fileBase={`medqr-MQ-${preview.code}`} />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Offscreen artboards for the multi-page PDF (must be laid out, so not display:none). */}
      <div aria-hidden style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}>
        {selectedCodes.map((c) => (
          <PosterArtboard key={`${c.id}-${batchKind}`} ref={refFor(c.id)} kind={batchKind} content={posterContentFor(c)} />
        ))}
      </div>
    </div>
  );
}

/** Link a code to a clinic/hospital. The doctor is optional: none = whole clinic (patients pick the doctor). */
function AssignRow({ api, tenants, onAssign }: { api: AdminApi; tenants: AdminTenant[]; onAssign: (tenantId: string, doctorId: string | null) => void }) {
  const [tenantId, setTenantId] = useState('');
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [doctorId, setDoctorId] = useState('');

  useEffect(() => {
    setDoctorId('');
    setDoctors([]);
    if (tenantId) api.doctors(tenantId).then(setDoctors).catch(() => setDoctors([]));
  }, [api, tenantId]);

  return (
    <div className="px-4 pb-4 flex items-end gap-2 flex-wrap bg-surface-container-low/60">
      <label className="flex flex-col gap-1 pt-3">
        <span className="font-label-sm text-label-sm text-on-surface-variant">Clinic</span>
        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-md text-body-md min-w-[220px]">
          <option value="">Select clinic…</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.display_name ?? t.subdomain} ({t.subdomain})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">Doctor (optional)</span>
        <select value={doctorId} disabled={!tenantId} onChange={(e) => setDoctorId(e.target.value)} className="h-10 rounded-lg bg-surface-container-lowest px-2 font-body-md text-body-md min-w-[200px] disabled:opacity-50">
          <option value="">Whole clinic — patient picks the doctor</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!tenantId}
        onClick={() => onAssign(tenantId, doctorId || null)}
        className="h-10 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-40"
      >
        {doctorId ? 'Link to doctor' : 'Link to clinic'}
      </button>
    </div>
  );
}
