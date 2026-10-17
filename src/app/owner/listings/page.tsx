'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { AdminApi, ListingCandidate } from '@/lib/adminApi';
import { Icon } from '@/components/patient/ui';
import { AdminShell } from '@/components/admin/AdminShell';

// Decision 60 — Google Maps exports (Apify) land here. Pick listings, then Import turns them into
// ordinary clinics. Unticked rows stay in this list until you delete them on purpose.

export default function AdminListingsPage() {
  return <AdminShell active="/owner/listings">{(api, me) => <Listings api={api} marketer={me.role === 'marketer'} />}</AdminShell>;
}

const UPLOAD_CHUNK = 500; // whole PIN areas per request, so the server can tidy city names (Decision 60)
const IMPORT_CHUNK = 50;
const SHOW_AT_A_TIME = 200;

const words = (s: string) =>
  s
    .toLowerCase()
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

/** The town/district part of the address ("…, Sitamarhi, Bihar 843302, India" -> "Sitamarhi"). */
function areaOf(l: ListingCandidate): string {
  const parts = (l.address ?? '').split(',').map((p) => p.trim());
  if (parts.length >= 3) return parts[parts.length - 3] || l.city || 'Unknown';
  return (l.city ?? '').split(',')[0].trim() || 'Unknown';
}

const haystack = (l: ListingCandidate) => [l.title, l.category, ...l.categories, l.address, l.search_term].filter(Boolean).join(' ').toLowerCase();

function Listings({ api, marketer }: { api: AdminApi; marketer: boolean }) {
  const [rows, setRows] = useState<ListingCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set()); // ids we've already decided a default for, so unticking survives a reload

  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState('');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState('');
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [showImported, setShowImported] = useState(false);
  const [limit, setLimit] = useState(SHOW_AT_A_TIME);

  const load = async () => {
    try {
      const data = await api.listings();
      setRows(data);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of data) {
          if (r.status !== 'pending') next.delete(r.id);
          else if (!seen.current.has(r.id)) next.add(r.id); // new rows start ticked
          seen.current.add(r.id);
        }
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const pending = useMemo(() => (rows ?? []).filter((r) => r.status === 'pending'), [rows]);
  const importedCount = (rows?.length ?? 0) - pending.length;
  const areas = useMemo(() => [...new Set((rows ?? []).map(areaOf))].sort(), [rows]);
  const categories = useMemo(() => [...new Set((rows ?? []).map((r) => r.category).filter((c): c is string => !!c))].sort(), [rows]);

  const shown = useMemo(() => {
    const include = words(search);
    return (rows ?? []).filter((r) => {
      if (r.status === 'imported' && !showImported) return false;
      if (area && areaOf(r) !== area) return false;
      if (category && r.category !== category) return false;
      if (onlyPhone && !r.phone) return false;
      if (include.length && !include.some((w) => haystack(r).includes(w))) return false;
      return true;
    });
  }, [rows, search, area, category, onlyPhone, showImported]);
  useEffect(() => setLimit(SHOW_AT_A_TIME), [search, area, category, onlyPhone, showImported]);

  const shownPending = shown.filter((r) => r.status === 'pending');
  const selectedCount = pending.filter((r) => selected.has(r.id)).length;
  const unselected = pending.filter((r) => !selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (list: ListingCandidate[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of list) (on ? next.add(r.id) : next.delete(r.id));
      return next;
    });

  /** Unticks every pending listing whose name/category/address has any of the "skip words" in it. */
  const unselectSkipWords = () => {
    const skipWords = words(skip);
    if (!skipWords.length) return;
    const hits = pending.filter((r) => skipWords.some((w) => haystack(r).includes(w)));
    setMany(hits, false);
    setNotice(`Unticked ${hits.length} listing${hits.length === 1 ? '' : 's'} matching: ${skipWords.join(', ')}`);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setNotice(null);
    let added = 0;
    let already = 0;
    let closed = 0;
    let excluded = 0;
    try {
      for (const file of Array.from(files)) {
        setBusy(`Reading ${file.name}…`);
        const data: unknown = JSON.parse(await file.text());
        if (!Array.isArray(data)) throw new Error(`${file.name}: expected a list of places (an Apify JSON export)`);
        const slim = (data as Record<string, unknown>[])
          .filter((d) => d && typeof d.placeId === 'string' && typeof d.title === 'string')
          .map((d) => ({
            placeId: d.placeId,
            title: d.title,
            categoryName: d.categoryName,
            categories: d.categories,
            address: d.address,
            city: d.city,
            phone: d.phone,
            website: d.website,
            totalScore: d.totalScore,
            reviewsCount: d.reviewsCount,
            url: d.url,
            searchString: d.searchString,
            permanentlyClosed: d.permanentlyClosed,
            postalCode: d.postalCode,
          }));
        if (!slim.length) throw new Error(`${file.name}: no places found — is this the Google Maps scraper export?`);
        for (let i = 0; i < slim.length; i += UPLOAD_CHUNK) {
          setBusy(`Uploading ${file.name} (${Math.min(i + UPLOAD_CHUNK, slim.length)}/${slim.length})…`);
          const r = await api.uploadListings(slim.slice(i, i + UPLOAD_CHUNK));
          added += r.added;
          already += r.already_there;
          closed += r.closed_skipped;
          excluded += r.excluded_skipped ?? 0;
        }
      }
      setNotice(`Added ${added} new listing${added === 1 ? '' : 's'}. ${already} were already here${closed ? `, ${closed} permanently closed skipped` : ''}${excluded ? `, ${excluded} unrelated, pharmacy or lab listings left out` : ''}.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const importSelected = async () => {
    const ids = pending.filter((r) => selected.has(r.id)).map((r) => r.id);
    if (!ids.length) return;
    if (!window.confirm(`Create ${ids.length} clinic${ids.length === 1 ? '' : 's'}? Each is listed publicly with its address and phone, on the free plan (no online tokens until it opts in). The ${unselected.length} unticked listing${unselected.length === 1 ? '' : 's'} stay here.`)) return;
    setError(null);
    setNotice(null);
    let ok = 0;
    const failures: string[] = [];
    try {
      for (let i = 0; i < ids.length; i += IMPORT_CHUNK) {
        setBusy(`Importing ${Math.min(i + IMPORT_CHUNK, ids.length)}/${ids.length}…`);
        const res = await api.importListings(ids.slice(i, i + IMPORT_CHUNK));
        ok += res.imported;
        for (const r of res.results) if (!r.ok) failures.push(r.error ?? 'failed');
      }
    } catch (e) {
      failures.push((e as Error).message);
    }
    setBusy(null);
    setNotice(`Created ${ok} clinic${ok === 1 ? '' : 's'}.${failures.length ? ` ${failures.length} failed (first: ${failures[0]}).` : ''}`);
    await load();
  };

  const deleteUnselected = async () => {
    if (!unselected.length) return;
    if (!window.confirm(`Permanently delete ${unselected.length} unticked listing${unselected.length === 1 ? '' : 's'} from this list? Clinics already created are not affected.`)) return;
    setError(null);
    setBusy('Deleting…');
    try {
      const r = await api.deleteListings(unselected.map((u) => u.id));
      setNotice(`Deleted ${r.deleted} listing${r.deleted === 1 ? '' : 's'}.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg">{marketer ? 'My clinic submissions' : 'Clinic listings'}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            {marketer ? 'Add clinic details below or upload a Google Maps export. Only your own submissions appear here. A super admin reviews each clinic before publication and per-clinic earnings.' : <>Upload a Google Maps export, tick the clinics you want, and approve them for the public directory on the free plan. Online tokens stay hidden until enabled. Unticked rows stay here. Manage approved clinics in <Link href="/owner/clinics" className="text-primary underline">Clinics</Link>.</>}
          </p>
        </div>
        <div>
          <input ref={fileInput} type="file" accept=".json,application/json" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={!!busy}
            className="h-10 px-4 rounded-full bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60"
          >
            <Icon name="upload_file" className="text-[20px]" /> Upload file(s)
          </button>
        </div>
      </div>

      {!marketer && <ProductCatalog api={api} />}
      <ListingForm api={api} onSaved={load} />
      {error && <p className="font-body-md text-body-md text-error">{error}</p>}
      {notice && <p className="font-body-md text-body-md text-primary">{notice}</p>}
      {busy && <p className="font-body-md text-body-md text-on-surface-variant">{busy}</p>}
      {rows === null && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {rows?.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">No listings yet. Upload an Apify Google Maps export to start.</p>}

      {rows && rows.length > 0 && (
        <>
          <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Show only (words, comma-separated)</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="hospital, nursing home" className="h-10 px-3 rounded-lg bg-surface-container-low font-body-md text-body-md" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Place</span>
                <select value={area} onChange={(e) => setArea(e.target.value)} className="h-10 px-3 rounded-lg bg-surface-container-low font-body-md text-body-md">
                  <option value="">All places</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 px-3 rounded-lg bg-surface-container-low font-body-md text-body-md">
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Untick anything with these words (comma-separated)</span>
                <input value={skip} onChange={(e) => setSkip(e.target.value)} placeholder="dental, veterinary, pharmacy" className="h-10 px-3 rounded-lg bg-surface-container-low font-body-md text-body-md" />
              </label>
              <button onClick={unselectSkipWords} disabled={!words(skip).length} className="h-10 px-4 rounded-full bg-surface-container-low text-on-surface font-label-sm text-label-sm disabled:opacity-50">
                Untick matches
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 font-body-sm text-body-sm">
                <input type="checkbox" checked={onlyPhone} onChange={(e) => setOnlyPhone(e.target.checked)} /> Only with a phone number
              </label>
              <label className="flex items-center gap-2 font-body-sm text-body-sm">
                <input type="checkbox" checked={showImported} onChange={(e) => setShowImported(e.target.checked)} /> Show already imported ({importedCount})
              </label>
              <span className="flex-1" />
              <button onClick={() => setMany(shownPending, true)} className="h-9 px-3 rounded-full bg-surface-container-low font-label-sm text-label-sm">
                Tick all shown ({shownPending.length})
              </button>
              <button onClick={() => setMany(shownPending, false)} className="h-9 px-3 rounded-full bg-surface-container-low font-label-sm text-label-sm">
                Untick all shown
              </button>
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
            {shown.length === 0 && <p className="px-5 py-6 font-body-md text-body-md text-on-surface-variant">Nothing matches these filters.</p>}
            {shown.slice(0, limit).map((l) => {
              const imported = l.status === 'imported';
              return (
                <label key={l.id} className={`flex items-start gap-3 px-4 py-3 border-b border-surface-container last:border-0 ${imported ? 'opacity-60' : 'cursor-pointer'}`}>
                  <input type="checkbox" className="mt-1.5" disabled={imported} checked={!imported && selected.has(l.id)} onChange={() => toggle(l.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-label-lg text-label-lg">{l.title}</p>
                      {l.doctor_name && <span className="text-body-sm">{l.doctor_name}</span>}
                      {l.category && <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">{l.category}</span>}
                      {marketer && !imported && <span className="text-label-sm text-on-surface-variant">Awaiting approval</span>}
                      {imported && <span className="px-2 py-0.5 rounded-full bg-tertiary-container text-white font-label-sm text-label-sm">Imported</span>}
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{l.address ?? 'No address'}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {l.phone ?? 'No phone'}
                      {l.rating ? ` · ★ ${l.rating}${l.reviews_count ? ` (${l.reviews_count})` : ''}` : ''}
                    </p>
                  </div>
                  {l.maps_url && (
                    <a href={l.maps_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="h-8 w-8 shrink-0 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center" aria-label="Open in Google Maps">
                      <Icon name="map" className="text-[18px]" />
                    </a>
                  )}
                </label>
              );
            })}
            {shown.length > limit && (
              <button onClick={() => setLimit((n) => n + SHOW_AT_A_TIME)} className="w-full py-3 font-label-lg text-label-lg text-primary">
                Show more ({shown.length - limit} left)
              </button>
            )}
          </section>
        </>
      )}

      {!marketer && pending.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-surface-container-lowest border-t border-surface-container px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <p className="font-body-md text-body-md">
            <strong>{selectedCount}</strong> ticked · {unselected.length} unticked
          </p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={deleteUnselected} disabled={!!busy || !unselected.length} className="h-10 px-4 rounded-full bg-surface-container-low text-error font-label-lg text-label-lg disabled:opacity-50">
              Delete {unselected.length} unticked
            </button>
            <button onClick={importSelected} disabled={!!busy || !selectedCount} className="h-10 px-5 rounded-full bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-50">
              Import {selectedCount} as clinics
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ListingForm({ api, onSaved }: { api: AdminApi; onSaved: () => Promise<void> }) {
  const empty = { title: '', doctorName: '', categoryName: 'Medical clinic', city: '', address: '', phone: '', url: '' };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return <form className="bg-surface-container-lowest rounded-2xl p-5 flex flex-col gap-3" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setNote(null);
    try { const res = await api.submitListing(form); setNote(res.added ? 'Submitted for approval.' : 'This clinic was already submitted. No duplicate was created.'); setForm(empty); await onSaved(); }
    catch (error) { setNote((error as Error).message); } finally { setBusy(false); }
  }}>
    <h2 className="font-headline-sm text-headline-sm">Add a clinic and its doctor</h2>
    <p className="text-body-sm text-on-surface-variant">The address belongs to the clinic. Add a doctor only when you know their name; approval creates a linked doctor profile.</p>
    <div className="grid sm:grid-cols-2 gap-3">
      {([['title', 'Clinic name', true], ['doctorName', 'Doctor name (optional)', false], ['categoryName', 'Category / specialty', false], ['city', 'City / district', true], ['address', 'Clinic address', true], ['phone', 'Public clinic phone (optional)', false], ['url', 'Google Maps link (optional)', false]] as const).map(([key, label, required]) => <label key={key} className="flex flex-col gap-1 text-label-md">{label}
        <input aria-label={label} required={required} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="h-11 bg-surface-container-low rounded-xl px-3" />
      </label>)}
    </div>
    {note && <p role="status">{note}</p>}
    <button disabled={busy} className="h-11 px-5 self-start rounded-xl bg-primary text-on-primary disabled:opacity-50">{busy ? 'Submitting…' : 'Submit clinic for approval'}</button>
  </form>;
}

function ProductCatalog({ api }: { api: AdminApi }) {
  const [products, setProducts] = useState<{ key: string; name: string }[]>([]);
  const [name, setName] = useState(''); const [key, setKey] = useState(''); const [note, setNote] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { api.directoryProducts().then(setProducts).catch(() => undefined); }, [api]);
  return <section className="rounded-2xl bg-surface-container-lowest p-5 flex flex-col gap-3">
    <h2 className="font-headline-sm text-headline-sm">ClinicQ products</h2>
    <p className="text-body-sm text-on-surface-variant">ClinicQ is the umbrella brand. QR Token System is the default filter in the super-admin clinic list. Add future products here, then assign clinics from their clinic page. Products are internal filters and do not affect the public clinic and doctor directory.</p>
    <p>{products.map(p => p.name).join(' · ')}</p>
    <form className="flex flex-wrap gap-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setNote(null); try { await api.createDirectoryProduct({ key, name }); setProducts(await api.directoryProducts()); setName(''); setKey(''); setNote('Product filter added.'); } catch(error) { setNote((error as Error).message); } finally { setBusy(false); } }}>
      <label className="flex flex-col gap-1">Product name<input aria-label="New product name" required value={name} onChange={e=>setName(e.target.value)} placeholder="Patient Admissions" className="h-11 rounded-xl bg-surface-container-low px-3" /></label>
      <label className="flex flex-col gap-1">Product code<input aria-label="New product code" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={key} onChange={e=>setKey(e.target.value.toLowerCase())} placeholder="patient-admissions" className="h-11 rounded-xl bg-surface-container-low px-3" /></label>
      <button disabled={busy} className="self-end h-11 px-4 rounded-xl bg-primary text-on-primary disabled:opacity-50">Add product filter</button>
    </form>{note && <p role="status">{note}</p>}
  </section>;
}
