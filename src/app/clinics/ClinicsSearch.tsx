'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, type DirectoryClinicSummary } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { patientUrl } from '@/lib/clinicHost';
import { useHost } from '@/lib/useHost';
import { InfiniteFooter, useInfiniteScroll } from '@/lib/useInfiniteScroll';

const PAGE_SIZE = 24;

export function ClinicsSearch({ initialQ = '', initialCity = '', initialArea = '', initialBookable = false, initialToday = false }: {
  initialQ?: string; initialCity?: string; initialArea?: string; initialBookable?: boolean; initialToday?: boolean;
}) {
  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState(initialCity);
  const [area, setArea] = useState(initialArea);
  const [bookable, setBookable] = useState(initialBookable);
  const [today, setToday] = useState(initialToday);
  const [cities, setCities] = useState<string[]>([]);
  const [results, setResults] = useState<DirectoryClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const active = !!(q || city || area || bookable || today);
  const host = useHost();
  const options = { q, city, area, bookable: bookable ? '1' : undefined, today: today ? '1' : undefined, limit: String(PAGE_SIZE) };

  useEffect(() => { api.directoryCities().then(setCities).catch(() => undefined); }, []);

  useEffect(() => {
    const version = ++generation.current;
    setLoading(true); setResults([]); setLoadingMore(false); setError(null); setMore(false);
    const timer = setTimeout(() => {
      api.directoryClinicsSearch({ q, city, area, bookable: bookable ? '1' : undefined, today: today ? '1' : undefined, limit: String(PAGE_SIZE) })
        .then(rows => { if (generation.current === version) { setResults(rows); setMore(rows.length === PAGE_SIZE); } })
        .catch(() => { if (generation.current === version) setError('We couldn’t load clinics. Please try again.'); })
        .finally(() => { if (generation.current === version) setLoading(false); });
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (city) params.set('city', city);
      if (area) params.set('area', area);
      if (bookable) params.set('bookable', '1');
      if (today) params.set('today', '1');
      window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
    }, 250);
    return () => { clearTimeout(timer); generation.current = version + 1; };
  }, [q, city, area, bookable, today, retry]);

  const clear = () => { setQ(''); setCity(''); setArea(''); setBookable(false); setToday(false); };
  const loadMore = async () => {
    const version = generation.current;
    setLoadingMore(true); setError(null);
    try {
      const rows = await api.directoryClinicsSearch({ ...options, offset: String(results.length) });
      if (generation.current === version) { setResults(previous => [...previous, ...rows]); setMore(rows.length === PAGE_SIZE); }
    } catch { if (generation.current === version) setError('More clinics couldn’t be loaded. Please try again.'); }
    finally { if (generation.current === version) setLoadingMore(false); }
  };

  const sentinel = useInfiniteScroll(loadMore, more && !error);

  return <div className="flex flex-col gap-6" data-ui>
    <section aria-label="Find clinics" className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface-container-lowest p-4 sm:p-5 grid grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-3 sm:gap-4">
        <label className="col-span-2 lg:col-span-1 flex flex-col gap-2 text-label-md">
          Doctor, clinic or specialty
          <span className="flex h-12 items-center gap-2 rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary">
            <Icon name="search" className="text-xl text-primary shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search for care" className="min-w-0 w-full bg-transparent text-body-lg outline-none" />
          </span>
        </label>
        <label className="flex flex-col gap-2 text-label-md">City
          <select value={city} onChange={e => { setCity(e.target.value); setArea(''); }} className="h-12 min-w-0 w-full rounded-xl bg-surface-container-low px-3 text-body-lg focus:ring-2 focus:ring-primary outline-none">
            <option value="">All cities</option>
            {[...new Set([...cities, ...(city ? [city] : [])])].sort().map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-label-md">Area or landmark
          <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Dumra Road" className="h-12 min-w-0 w-full rounded-xl bg-surface-container-low px-3 text-body-lg focus:ring-2 focus:ring-primary outline-none" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <FilterChip label="Online booking" icon="confirmation_number" selected={bookable} onClick={() => setBookable(!bookable)} />
        <FilterChip label="Available today" icon="today" selected={today} onClick={() => setToday(!today)} />
        {active && <button onClick={clear} className="min-h-11 px-2 text-label-md text-primary sm:ml-auto underline underline-offset-4">Clear filters</button>}
      </div>
      {today && <p className="text-body-sm text-on-surface-variant">Clinics accepting online tokens for today, including sessions starting later today.</p>}
    </section>

    <section aria-label="Clinic results" aria-busy={loading} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-headline text-headline-md">{city ? `Clinics in ${city}` : 'Explore clinics'}</h2>
          <p role="status" className="mt-1 text-body-md text-on-surface-variant">{loading ? 'Finding clinics…' : error && !results.length ? 'Search is temporarily unavailable' : `${results.length}${more ? '+' : ''} clinic${results.length === 1 ? '' : 's'}${active ? (results.length === 1 ? ' matches your search' : ' match your search') : ' to explore'}`}</p>
        </div>
        <span className="text-body-sm text-on-surface-variant">Online booking clinics first</span>
      </div>
      {error && <div role="alert" className="rounded-xl bg-error-container p-4 text-on-error-container text-body-md">{error} <button className="underline font-semibold ml-2 min-h-11" onClick={() => more ? loadMore() : setRetry(v => v + 1)}>Try again</button></div>}
      {loading ? <div className="grid md:grid-cols-2 gap-4" aria-hidden="true">{[0, 1, 2, 3].map(i => <div key={i} className="h-64 rounded-2xl bg-surface-container-lowest motion-safe:animate-pulse" />)}</div> : <>
        {!error && results.length === 0 && <div className="rounded-2xl bg-surface-container-lowest p-8 sm:p-12 text-center">
          <Icon name="search_off" className="text-4xl text-primary" />
          <h3 className="font-headline text-headline-sm mt-3">No clinics match these filters</h3>
          <p className="text-body-md text-on-surface-variant mt-2">Try another location or remove a filter to see more clinics.</p>
          <button onClick={clear} className="min-h-11 mt-5 rounded-xl bg-primary px-5 text-on-primary text-label-lg">Clear filters</button>
        </div>}
        <div className="flex flex-col gap-4 sm:gap-5">{results.map(c => <ClinicCard key={c.slug} clinic={c} host={host} />)}</div>
        <InfiniteFooter sentinel={sentinel} hasMore={more && !error} loading={loadingMore} />
      </>}
    </section>
  </div>;
}

function FilterChip({ label, icon, selected, onClick }: { label: string; icon: string; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-11 rounded-full px-4 flex items-center gap-2 text-label-md sm:text-label-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'}`}>
    <Icon name={selected ? 'check_circle' : icon} className="text-lg" />{label}
  </button>;
}

function ClinicCard({ clinic: c, host }: { clinic: DirectoryClinicSummary; host: string | null }) {
  const href = `/clinics/${c.slug}`;
  const directions = c.maps_url && /^https?:\/\//i.test(c.maps_url) ? c.maps_url : c.address || c.city ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.clinic_name, c.address, c.city].filter(Boolean).join(', '))}` : null;
  const doctors = c.doctors ?? [];
  return <article className="rounded-2xl bg-surface-container-lowest p-5 sm:p-6 flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_220px] gap-4 md:gap-8">
    <div className="flex flex-col gap-3">
    <div className="flex items-start gap-3">
      <span className="w-11 h-11 shrink-0 rounded-xl bg-primary-fixed/40 text-primary flex items-center justify-center"><Icon name="local_hospital" className="text-2xl" /></span>
      <div className="min-w-0">
        <Link href={href} className="font-headline text-headline-sm hover:text-primary break-words">{c.clinic_name}</Link>
        {(c.address || c.city) && <p className="mt-1 text-body-md text-on-surface-variant flex gap-1.5"><Icon name="location_on" className="text-lg shrink-0" /><span className="line-clamp-2">{c.address}{c.address && c.city && !c.address.toLowerCase().includes(c.city.toLowerCase()) ? `, ${c.city}` : !c.address ? c.city : ''}</span></p>}
      </div>
    </div>
    {c.specialties?.length ? <p className="text-body-md text-on-surface-variant line-clamp-2">{c.specialties.slice(0, 3).join(' · ')}</p> : null}
    {doctors.length > 0 && <p className="text-body-md flex items-start gap-2"><Icon name="stethoscope" className="text-lg text-primary" /><span>{doctors[0].name}{c.doctor_count > 1 ? ` + ${c.doctor_count - 1} more` : ''}</span></p>}
    {c.booking_open && <div className="flex flex-wrap gap-2 items-center">
      <span className="rounded-full bg-primary-fixed/40 px-3 py-1 text-label-md text-primary inline-flex items-center gap-1.5"><Icon name="confirmation_number" className="text-base" />Online booking</span>
      {c.available_today && <span className="inline-flex items-center gap-1.5 text-label-md text-tertiary"><span className="h-2 w-2 rounded-full bg-tertiary" />Available today</span>}
    </div>}
    </div>
    <div className="mt-auto md:my-auto pt-1 flex flex-col gap-2">
      {c.booking_open && c.subdomain ? <Link href={patientUrl(`/patient/${encodeURIComponent(c.subdomain)}`, host)} className="min-h-12 rounded-xl bg-primary text-on-primary text-label-lg flex items-center justify-center gap-2">Get a token<Icon name="arrow_forward" className="text-lg" /></Link> : <Link href={href} className="min-h-12 rounded-xl bg-surface-container-low text-primary text-label-lg flex items-center justify-center">View clinic</Link>}
      <div className="flex items-center gap-3 justify-between">
        {c.booking_open ? <Link href={href} className="min-h-11 inline-flex items-center text-label-md text-primary">{c.doctor_count > 0 ? 'View doctors' : 'Clinic details'}</Link> : c.public_phone ? <a href={`tel:${c.public_phone.replace(/[^+\d]/g, '')}`} className="min-h-11 inline-flex items-center gap-1.5 text-label-md text-primary"><Icon name="call" className="text-lg" />Call clinic</a> : <span />}
        {directions && <a href={directions} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center gap-1.5 text-label-md text-primary"><Icon name="near_me" className="text-lg" />Directions</a>}
      </div>
    </div>
  </article>;
}
