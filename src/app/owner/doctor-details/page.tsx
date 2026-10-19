'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminApi, DoctorEnrichment } from '@/lib/adminApi';
import { AdminShell } from '@/components/admin/AdminShell';

// Decision 67 — type a doctor's name + clinic address; the agent finds public details on Practo / Justdial / Lybrate…
// and lists them here. Nothing reaches the doctor's profile until you tick it and press Confirm.

export default function DoctorDetailsPage() {
  return <AdminShell active="/owner/doctor-details">{(api, me) => (me.role === 'super' || !me.role ? <Details api={api} /> : <p className="font-body-md text-body-md">Super admin only.</p>)}</AdminShell>;
}

const STATUS: Record<DoctorEnrichment['status'], string> = {
  queued: 'Waiting', searching: 'Searching…', review: 'Ready to review', inactive: 'Not practising — skipped',
  not_found: 'Not found', applied: 'Applied', failed: 'Failed',
};
type Found = NonNullable<DoctorEnrichment['found']>;
const FIELDS: { key: keyof Found; label: string; number?: boolean }[] = [
  { key: 'specialty', label: 'Specialty' },
  { key: 'qualification', label: 'Qualification' },
  { key: 'experience_years', label: 'Experience (years)', number: true },
  { key: 'consultation_fee_inr', label: 'Fee (₹)', number: true },
  { key: 'bio', label: 'Short bio' },
];

function Details({ api }: { api: AdminApi }) {
  const [rows, setRows] = useState<DoctorEnrichment[] | null>(null);
  const [text, setText] = useState('');
  const [city, setCity] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [credits, setCredits] = useState<{ balance: number | null; per_doctor: number } | null>(null);

  const load = useCallback(async () => {
    try { setRows(await api.doctorEnrich()); } catch (e) { setMsg((e as Error).message); }
  }, [api]);
  const loadCredits = useCallback(() => { api.doctorEnrichCredits().then(setCredits).catch(() => setCredits(null)); }, [api]);
  useEffect(() => { load(); loadCredits(); }, [load, loadCredits]);
  // credits drop as lookups finish, so refresh them whenever the list settles
  useEffect(() => { if (rows && !rows.some((r) => r.status === 'queued' || r.status === 'searching')) loadCredits(); }, [rows, loadCredits]);
  // keep refreshing while the agent is still working
  useEffect(() => {
    if (!rows?.some((r) => r.status === 'queued' || r.status === 'searching')) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [rows, load]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setMsg(null);
    try { setMsg(await fn()); await load(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  // One doctor per line: "Dr Name | clinic address"
  const add = () => run(async () => {
    const items = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, ...rest] = l.split('|');
      return { name: name.trim(), address: rest.join('|').trim(), city: city.trim() || undefined };
    });
    if (!items.length || items.some((i) => !i.name || !i.address)) throw new Error('Each line needs: Doctor name | clinic address');
    const r = await api.addDoctorEnrich(items);
    setText('');
    return `${r.added} added${r.skipped ? `, ${r.skipped} already there` : ''}. Searching now…`;
  });

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...picked];
  const ready = (rows ?? []).filter((r) => r.status === 'review');

  const edit = (r: DoctorEnrichment, key: keyof Found, raw: string, number?: boolean) =>
    run(async () => {
      const value = raw.trim() === '' ? null : number ? Number(raw) : raw.trim();
      await api.editDoctorEnrich(r.id, { [key]: value });
      return 'Saved';
    });

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div>
        <h1 className="font-headline-lg text-headline-lg">Doctor details</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          Add doctors as <b>Doctor name | clinic address</b>, one per line. The agent looks them up on Practo, Justdial, Lybrate and similar sites, checks the name and area match, and skips anyone shown as closed or retired. Review what it found, fix anything, then Confirm to fill the doctor&apos;s profile.
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        {credits && (
          <p className="font-body-md text-body-md">
            <span className="px-3 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-md text-label-md">
              {credits.balance === null ? 'Search credits: unavailable' : `Search credits left: ${credits.balance.toLocaleString('en-IN')}`}
            </span>
            <span className="ml-2 text-on-surface-variant font-body-sm text-body-sm">
              {credits.balance === null ? 'Check SERPER_API_KEY on the server.' : `About ${credits.per_doctor} per doctor — enough for roughly ${Math.floor(credits.balance / credits.per_doctor).toLocaleString('en-IN')} more doctors.`}
            </span>
          </p>
        )}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={'Dr. Anil Kumar | Boring Road, Patna, Bihar 800001\nDr. Rina Singh | Hospital Road, Sitamarhi 843302'} className="p-3 rounded-lg bg-surface-container-low font-body-md text-body-md" />
        <div className="flex flex-wrap gap-3 items-center">
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional, helps the search)" className="h-10 px-3 rounded-lg bg-surface-container-low font-body-md text-body-md" />
          <button onClick={add} disabled={busy || !text.trim()} className="h-10 px-4 rounded-full bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">Find details</button>
        </div>
      </section>

      {msg && <p className="font-body-md text-body-md text-primary">{msg}</p>}
      {rows === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}

      {rows && rows.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => setPicked(new Set(ready.map((r) => r.id)))} className="h-9 px-3 rounded-full bg-surface-container-low font-label-lg text-label-lg">Tick all ready</button>
          <button
            disabled={busy || !ids.length}
            onClick={() => window.confirm(`Fill ${ids.length} doctor profile${ids.length === 1 ? '' : 's'} with these details?`) && run(async () => { const r = await api.applyDoctorEnrich(ids); setPicked(new Set()); return `${r.applied} applied, ${r.failed} failed${r.results.filter((x) => !x.ok).map((x) => ` — ${x.error}`).join('')}`; })}
            className="h-9 px-4 rounded-full bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60"
          >Confirm selected ({ids.length})</button>
          <button disabled={busy || !ids.length} onClick={() => run(async () => { const r = await api.retryDoctorEnrich(ids); return `${r.queued} searching again`; })} className="h-9 px-3 rounded-full bg-surface-container-low font-label-lg text-label-lg disabled:opacity-60">Search again</button>
          <button disabled={busy || !ids.length} onClick={() => window.confirm('Are you sure?') && run(async () => { const r = await api.deleteDoctorEnrich(ids); setPicked(new Set()); return `${r.deleted} removed`; })} className="h-9 px-3 rounded-full bg-surface-container-low text-error font-label-lg text-label-lg disabled:opacity-60">Remove</button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(rows ?? []).map((r) => (
          <article key={r.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-2">
            <div className="flex items-start gap-3">
              {r.status !== 'applied' && <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="mt-1.5 h-5 w-5" />}
              <div className="flex-1 min-w-0">
                <p className="font-title-md text-title-md">{r.doctor_name}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{r.address}</p>
              </div>
              <span className="font-label-sm text-label-sm px-2 py-1 rounded-full bg-surface-container-low whitespace-nowrap">{STATUS[r.status]}</span>
            </div>
            {r.note && <p className="font-body-sm text-body-sm text-on-surface-variant">{r.note}</p>}
            {r.error && <p className="font-body-sm text-body-sm text-error">{r.error}</p>}
            {r.practising === 'unknown' && r.status === 'review' && <p className="font-body-sm text-body-sm text-on-surface-variant">Pages don&apos;t say whether they are currently practising — check before confirming.</p>}
            {r.status === 'review' && r.found && (
              <div className="grid gap-2 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <label key={f.key} className={`flex flex-col gap-1 ${f.key === 'bio' ? 'sm:col-span-2' : ''}`}>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{f.label}</span>
                    <input defaultValue={r.found?.[f.key] ?? ''} onBlur={(e) => e.target.value !== String(r.found?.[f.key] ?? '') && edit(r, f.key, e.target.value, f.number)} type={f.number ? 'number' : 'text'} className="h-10 px-3 rounded-lg bg-surface-container-low font-body-md text-body-md" />
                  </label>
                ))}
                {r.found.timings && <p className="font-body-sm text-body-sm text-on-surface-variant sm:col-span-2">Timings seen (not saved — the doctor sets hours): {r.found.timings}</p>}
              </div>
            )}
            {r.sources.length > 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Found on {r.agreeing_sites} site{r.agreeing_sites === 1 ? '' : 's'}:{' '}
                {r.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary underline mr-2">{s.site}</a>)}
              </p>
            )}
          </article>
        ))}
        {rows?.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">No doctors added yet.</p>}
      </div>
    </div>
  );
}
