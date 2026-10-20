'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/patient/ui';

/** Decision 58 — the home page's search box: All, Doctors or Clinics, searching directly to URL. */
export function HomeSearch({ initialQ = '', initialKind = 'all' }: { initialQ?: string; initialKind?: 'all' | 'doctors' | 'clinics' }) {
  const router = useRouter();
  const [kind, setKind] = useState<'all' | 'doctors' | 'clinics'>(initialKind);
  const [q, setQ] = useState(initialQ);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    const savedCity = typeof window !== 'undefined' ? (localStorage.getItem('clinicq:selected_city') || localStorage.getItem('clinicq_user_city')) : null;
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    if (savedCity) params.set('city', savedCity);
    const qs = params.size ? `?${params.toString()}` : '';
    if (kind === 'all') {
      router.push(`/search${qs}`);
    } else {
      router.push(`/${kind}${qs}`);
    }
  };

  const tab = (value: typeof kind, label: string) => (
    <button
      type="button"
      onClick={() => setKind(value)}
      aria-pressed={kind === value}
      className={`h-9 px-4 rounded-full font-label-md text-label-md transition-colors ${
        kind === value ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'
      }`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={go} className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-md p-3 flex flex-col gap-3">
      <div className="flex gap-1">
        {tab('all', 'All')}
        {tab('doctors', 'Doctors')}
        {tab('clinics', 'Clinics')}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center bg-surface-container-low rounded-xl px-3 h-14">
          <Icon name="search" className="text-[22px] text-on-surface-variant" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={kind === 'doctors' ? 'Doctor name, specialty or clinic…' : 'Clinic name or city…'}
            aria-label={kind === 'doctors' ? 'Search doctors' : 'Search clinics'}
            className="flex-1 min-w-0 bg-transparent px-2 font-body-lg text-body-lg focus:outline-none"
          />
        </div>
        <button className="h-14 px-5 sm:px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shrink-0">Search</button>
      </div>
    </form>
  );
}
