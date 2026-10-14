'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type DirectoryClinicSummary } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// Decision 51 — clinics are searchable too, the same way /doctors already is: name/city search, a
// city filter, and a result list linking into each clinic's own landing page (Decision 50).

export function ClinicsSearch({ initialQ }: { initialQ?: string }) {
  const [q, setQ] = useState(initialQ ?? '');
  const [city, setCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [results, setResults] = useState<DirectoryClinicSummary[] | null>(null);

  useEffect(() => {
    api.directoryCities().then(setCities).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.directoryClinicsSearch({ q, city }).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, city]);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center bg-surface-container-low rounded-xl px-3 h-12">
          <Icon name="search" className="text-[20px] text-on-surface-variant" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Clinic name or city…"
            className="flex-1 bg-transparent px-2 font-body-md text-body-md focus:outline-none"
          />
        </div>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {results === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {results?.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant">No clinics match yet — try a different search, or check back soon.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {results?.map((c) => (
          <Link key={c.slug} href={`/clinics/${c.slug}`} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed text-primary font-bold flex items-center justify-center shrink-0">
              <Icon name="local_hospital" className="text-[22px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-label-lg text-label-lg truncate">{c.clinic_name}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {[c.city, `${c.doctor_count} doctor${c.doctor_count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Icon name="chevron_right" className="text-on-surface-variant" />
          </Link>
        ))}
      </div>
    </div>
  );
}
