'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, fileUrl, type DirectoryDoctorSummary } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// A screenful at a time; the next page loads as the visitor scrolls near the end (infinite scroll).
const PAGE_SIZE = 24;

export function DoctorsSearch({ initialQ, initialCity }: { initialQ?: string; initialCity?: string }) {
  const [q, setQ] = useState(initialQ ?? '');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState(initialCity ?? '');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [results, setResults] = useState<DirectoryDoctorSummary[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const searchId = useRef(0);

  useEffect(() => {
    api.directorySpecialties().then(setSpecialties).catch(() => undefined);
    api.directoryCities().then(setCities).catch(() => undefined);
  }, []);

  useEffect(() => {
    const id = ++searchId.current;
    const t = setTimeout(() => {
      api
        .directorySearch({ q, specialty, city, limit: String(PAGE_SIZE) })
        .then((rows) => { if (id === searchId.current) { setResults(rows); setHasMore(rows.length === PAGE_SIZE); } })
        .catch(() => { if (id === searchId.current) { setResults([]); setHasMore(false); } });
    }, 250);
    return () => clearTimeout(t);
  }, [q, specialty, city]);

  const loadMore = async () => {
    if (!results || !hasMore || loadingMore) return;
    const id = searchId.current;
    setLoadingMore(true);
    try {
      const rows = await api.directorySearch({ q, specialty, city, limit: String(PAGE_SIZE), offset: String(results.length) });
      if (id !== searchId.current) return; // the search changed while this page was loading
      setResults((prev) => [...(prev ?? []), ...rows.filter((r) => !prev?.some((p) => p.slug === r.slug))]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // Load the next page when the marker under the list scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  });

  const clearFilters = () => {
    setQ('');
    setSpecialty('');
    setCity('');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center bg-surface-container-low rounded-xl px-3 h-12">
          <Icon name="search" className="text-[20px] text-on-surface-variant" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Doctor name, specialty or clinic…"
            className="flex-1 bg-transparent px-2 font-body-md text-body-md focus:outline-none"
          />
        </div>
        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none">
          <option value="">All specialties</option>
          {specialties.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Popular specialties — real filter values, not invented ones; doubles as fill for an otherwise
          empty page before someone's typed anything. */}
      {specialties.length > 0 && !q && (
        <div className="flex flex-wrap gap-2">
          {specialties.slice(0, 10).map((s) => (
            <button
              key={s}
              onClick={() => setSpecialty(specialty === s ? '' : s)}
              className={`px-3 py-1.5 rounded-full font-label-md text-label-md transition-colors ${
                specialty === s ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant shadow-sm hover:bg-surface-container'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {results === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {results?.length === 0 && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-8 flex flex-col items-center text-center gap-2">
          <Icon name="search_off" className="text-[32px] text-on-surface-variant" />
          <p className="font-body-md text-body-md text-on-surface-variant">No doctors match yet — try a different search, or check back soon.</p>
          {(q || specialty || city) && (
            <button onClick={clearFilters} className="font-label-md text-label-md text-primary mt-1">
              Clear filters
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {results?.map((d) => (
          <div key={d.slug} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <Link href={`/doctors/${d.slug}`} className="flex items-center gap-3">
              {d.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(d.photo_url)} alt={d.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center shrink-0">
                  {d.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-label-lg text-label-lg truncate">{d.name}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{[d.specialty, d.city].filter(Boolean).join(' · ')}</p>
              </div>
              <Icon name="chevron_right" className="text-on-surface-variant" />
            </Link>
            {d.booking_open && <span className="self-start text-primary text-label-sm">Online tokens available</span>}
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
          </div>
        ))}
      </div>

      {hasMore && (
        <div ref={sentinel} className="flex justify-center">
          <button onClick={loadMore} disabled={loadingMore} className="h-11 px-5 rounded-xl bg-surface-container-lowest shadow-sm font-label-md text-label-md text-primary disabled:opacity-60">
            {loadingMore ? 'Loading…' : 'Show more doctors'}
          </button>
        </div>
      )}

      {/* Browse by city — real values from the directory, fills the page usefully before a search. */}
      {!q && !city && cities.length > 0 && (
        <div className="border-t border-surface-container pt-6 flex flex-col gap-3">
          <p className="font-label-lg text-label-lg text-on-surface">Browse by city</p>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className="px-3 py-1.5 rounded-full bg-surface-container-lowest shadow-sm font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
