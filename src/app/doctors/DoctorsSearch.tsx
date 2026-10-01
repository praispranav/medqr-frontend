'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type DirectoryDoctorSummary } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

export function DoctorsSearch({ initialQ }: { initialQ?: string }) {
  const [q, setQ] = useState(initialQ ?? '');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [results, setResults] = useState<DirectoryDoctorSummary[] | null>(null);

  useEffect(() => {
    api.directorySpecialties().then(setSpecialties).catch(() => undefined);
    api.directoryCities().then(setCities).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.directorySearch({ q, specialty, city }).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, specialty, city]);

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

      {results === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {results?.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant">No doctors match yet — try a different search, or check back soon.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {results?.map((d) => (
          <Link key={d.slug} href={`/doctors/${d.slug}`} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            {d.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.photo_url} alt={d.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
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
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{[d.specialty, d.clinic_name, d.city].filter(Boolean).join(' · ')}</p>
            </div>
            <Icon name="chevron_right" className="text-on-surface-variant" />
          </Link>
        ))}
      </div>
    </div>
  );
}
