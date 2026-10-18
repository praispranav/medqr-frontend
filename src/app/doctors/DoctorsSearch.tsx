'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, fileUrl, type DirectoryDoctorSummary } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { AskOnlineBooking } from '@/components/directory/AskOnlineBooking';
import { groupOf } from '@/lib/specialtyGroups';
import { InfiniteFooter, useInfiniteScroll } from '@/lib/useInfiniteScroll';

// A screenful at a time; the next page loads as the visitor scrolls near the end (infinite scroll).
export const DOCTORS_PAGE_SIZE = 24;

type Group = { slug: string; name: string; plural: string; count: number };

/**
 * Decision 66 — the doctor directory search. Filters live in the address (?q=&specialty=&city=&online=1)
 * so a search can be shared and reloaded. Landing pages (/doctors/in/patna/dentist) pass their filters and
 * the server-rendered first page in, and keep their own address (syncUrl=false).
 */
export function DoctorsSearch({
  initialQ = '',
  initialGroup = '',
  initialCity = '',
  initialBookable = false,
  initialResults,
  syncUrl = true,
}: {
  initialQ?: string;
  initialGroup?: string;
  initialCity?: string;
  initialBookable?: boolean;
  initialResults?: DirectoryDoctorSummary[];
  syncUrl?: boolean;
}) {
  const [q, setQ] = useState(initialQ);
  const [group, setGroup] = useState(initialGroup);
  const [city, setCity] = useState(initialCity);
  const [bookable, setBookable] = useState(initialBookable);
  const [groups, setGroups] = useState<Group[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [results, setResults] = useState<DirectoryDoctorSummary[] | null>(initialResults ?? null);
  const [hasMore, setHasMore] = useState((initialResults?.length ?? 0) === DOCTORS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchId = useRef(0);
  const firstRun = useRef(!!initialResults);
  const filters = { q: q.trim() || undefined, group: group || undefined, city: city || undefined, bookable: bookable ? '1' : undefined };

  useEffect(() => {
    api.directoryCities().then(setCities).catch(() => undefined);
  }, []);
  useEffect(() => {
    api.directorySpecialtyGroups(city || undefined).then(setGroups).catch(() => undefined);
  }, [city]);

  useEffect(() => {
    if (syncUrl) {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (group) params.set('specialty', group);
      if (city) params.set('city', city);
      if (bookable) params.set('online', '1');
      window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
    }
    // The server already rendered the first page for the starting filters.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const id = ++searchId.current;
    const t = setTimeout(() => {
      api
        .directorySearch({ ...filters, limit: String(DOCTORS_PAGE_SIZE) })
        .then((rows) => { if (id === searchId.current) { setResults(rows); setHasMore(rows.length === DOCTORS_PAGE_SIZE); } })
        .catch(() => { if (id === searchId.current) { setResults([]); setHasMore(false); } });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, group, city, bookable, syncUrl]);

  const loadMore = async () => {
    if (!results || !hasMore || loadingMore) return;
    const id = searchId.current;
    setLoadingMore(true);
    try {
      const rows = await api.directorySearch({ ...filters, limit: String(DOCTORS_PAGE_SIZE), offset: String(results.length) });
      if (id !== searchId.current) return; // the search changed while this page was loading
      setResults((prev) => [...(prev ?? []), ...rows.filter((r) => !prev?.some((p) => p.slug === r.slug))]);
      setHasMore(rows.length === DOCTORS_PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const sentinel = useInfiniteScroll(loadMore, hasMore);

  const active = !!(q || group || city || bookable);
  const clearFilters = () => {
    setQ('');
    setGroup('');
    setCity('');
    setBookable(false);
  };
  const field = 'h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none';

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center bg-surface-container-low rounded-xl px-3 h-12">
            <Icon name="search" className="text-[20px] text-on-surface-variant" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Doctor or clinic name…"
              aria-label="Search doctors"
              className="flex-1 bg-transparent px-2 font-body-md text-body-md focus:outline-none"
            />
          </div>
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Specialty" className={field}>
            <option value="">All specialties</option>
            {[...groups, ...(group && !groups.some((g) => g.slug === group) ? [{ slug: group, name: groupOf(group)?.name ?? group, plural: '', count: 0 }] : [])].map((g) => (
              <option key={g.slug} value={g.slug}>{g.name}</option>
            ))}
          </select>
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" className={field}>
            <option value="">All cities</option>
            {[...new Set([...cities, ...(city ? [city] : [])])].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <label className="self-start flex items-center gap-2 font-label-md text-label-md text-on-surface cursor-pointer">
          <input type="checkbox" checked={bookable} onChange={(e) => setBookable(e.target.checked)} className="w-4 h-4" />
          Only doctors with online OPD booking
        </label>
      </div>

      {/* Popular specialties — real values from the directory. */}
      {groups.length > 0 && !q && (
        <div className="flex flex-wrap gap-2">
          {groups.slice(0, 12).map((g) => (
            <button
              key={g.slug}
              onClick={() => setGroup(group === g.slug ? '' : g.slug)}
              className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-colors ${
                group === g.slug ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant shadow-sm hover:bg-surface-container'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {results === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {results?.length === 0 && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-8 flex flex-col items-center text-center gap-2">
          <Icon name="search_off" className="text-[32px] text-on-surface-variant" />
          <p className="font-body-md text-body-md text-on-surface-variant">No doctors match yet — we&apos;re adding more every week. Try a different search.</p>
          {active && (
            <button onClick={clearFilters} className="font-label-md text-label-md text-primary mt-1">
              Clear filters
            </button>
          )}
        </div>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {results?.map((d) => (
          <li key={d.slug} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <Link href={`/doctors/${d.slug}`} className="flex items-center gap-3">
              {d.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(d.photo_url)} alt={d.name} className="w-12 h-12 rounded-full object-cover shrink-0" loading="lazy" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center shrink-0" aria-hidden>
                  {d.name.replace(/^dr\.?\s*/i, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-label-lg text-label-lg truncate">{d.name}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {[groupOf(d.specialty)?.name ?? d.specialty, d.city].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Icon name="chevron_right" className="text-on-surface-variant" />
            </Link>
            {d.clinic_name && (
              <Link
                href={d.clinic_slug ? `/clinics/${d.clinic_slug}` : `/doctors/${d.slug}`}
                className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2 hover:bg-surface-container transition-colors"
              >
                <Icon name="local_hospital" className="text-[16px] text-primary shrink-0" />
                <span className="font-body-sm text-body-sm text-on-surface truncate flex-1">{d.clinic_name}</span>
                <span className="font-label-sm text-label-sm text-primary shrink-0">View clinic</span>
              </Link>
            )}
            {/* Decision 66: online OPD booking is a ClinicQ product — say clearly who has it. */}
            {d.booking_open ? (
              <Link href={`/doctors/${d.slug}`} className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-fixed/60 text-on-primary-fixed-variant font-label-md text-label-md">
                <Icon name="confirmation_number" className="text-[16px]" /> Online OPD booking available
              </Link>
            ) : (
              <AskOnlineBooking doctorSlug={d.slug} compact />
            )}
          </li>
        ))}
      </ul>

      <InfiniteFooter sentinel={sentinel} hasMore={hasMore} loading={loadingMore} />
    </div>
  );
}
