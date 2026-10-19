'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/patient/ui';
import { api, fileUrl, type DirectoryDoctorSummary, type DirectoryClinicSummary } from '@/lib/api';
import { directoryPath } from '@/lib/directoryServer';
import { groupOf, type SpecialtyGroup } from '@/lib/specialtyGroups';
import { OnlineTokenBadge } from '@/components/directory/OnlineTokenBadge';
import { VerifiedBadge } from '@/components/directory/VerifiedBadge';

interface Props {
  initialQ: string;
  initialType: 'all' | 'doctors' | 'clinics';
  initialCity: string;
  initialBookable: boolean;
  initialDoctors: DirectoryDoctorSummary[];
  initialClinics: DirectoryClinicSummary[];
  cities: string[];
  matchedGroup: SpecialtyGroup | null;
}

export function SearchClientView({
  initialQ,
  initialType,
  initialCity,
  initialBookable,
  initialDoctors,
  initialClinics,
  cities,
  matchedGroup,
}: Props) {
  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState(initialType);
  const [city, setCity] = useState(initialCity);
  const [bookable, setBookable] = useState(initialBookable);

  const [doctors, setDoctors] = useState<DirectoryDoctorSummary[]>(initialDoctors);
  const [clinics, setClinics] = useState<DirectoryClinicSummary[]>(initialClinics);
  const PAGE_SIZE = 24;
  const [loading, setLoading] = useState(false);
  const [doctorMore, setDoctorMore] = useState(initialDoctors.length === PAGE_SIZE);
  const [clinicMore, setClinicMore] = useState(initialClinics.length === PAGE_SIZE);
  const [loadingPage, setLoadingPage] = useState({ doctors: false, clinics: false });
  const [pageError, setPageError] = useState<'doctors' | 'clinics' | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const locks = useRef({ doctors: false, clinics: false });
  const firstRender = useRef(true);
  const searchId = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (type !== 'all') params.set('type', type);
    if (city) params.set('city', city);
    if (bookable) params.set('online', '1');
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }, [q, type, city, bookable]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const id = ++searchId.current;
    setLoading(true); setFailed(false); setPageError(null);
    setDoctorMore(false); setClinicMore(false);
    locks.current = { doctors: false, clinics: false };
    setLoadingPage({ doctors: false, clinics: false });
    setDoctors([]); setClinics([]);
    const timer = setTimeout(async () => {
      const filters = { q: q.trim() || undefined, city: city || undefined, bookable: bookable ? '1' : undefined, limit: String(PAGE_SIZE) };
      try {
        const [docs, cls] = await Promise.all([api.directorySearch(filters), api.directoryClinicsSearch(filters)]);
        if (id === searchId.current) {
          setDoctors(docs); setClinics(cls);
          setDoctorMore(docs.length === PAGE_SIZE); setClinicMore(cls.length === PAGE_SIZE);
        }
      } catch { if (id === searchId.current) setFailed(true); }
      finally { if (id === searchId.current) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); searchId.current = id + 1; };
  }, [q, city, bookable, retry]);

  const loadMore = async (kind: 'doctors' | 'clinics') => {
    if (loading || locks.current[kind] || !(kind === 'doctors' ? doctorMore : clinicMore)) return;
    const id = searchId.current;
    locks.current[kind] = true;
    setLoadingPage(prev => ({ ...prev, [kind]: true })); setPageError(null);
    const filters = { q: q.trim() || undefined, city: city || undefined, bookable: bookable ? '1' : undefined, limit: String(PAGE_SIZE), offset: String(kind === 'doctors' ? doctors.length : clinics.length) };
    try {
      if (kind === 'doctors') {
        const rows = await api.directorySearch(filters);
        if (id !== searchId.current) return;
        setDoctors(prev => [...prev, ...rows.filter(row => !prev.some(p => p.slug === row.slug))]); setDoctorMore(rows.length === PAGE_SIZE);
      } else {
        const rows = await api.directoryClinicsSearch(filters);
        if (id !== searchId.current) return;
        setClinics(prev => [...prev, ...rows.filter(row => !prev.some(p => p.slug === row.slug))]); setClinicMore(rows.length === PAGE_SIZE);
      }
    } catch { if (id === searchId.current) setPageError(kind); }
    finally {
      if (id === searchId.current) { locks.current[kind] = false; setLoadingPage(prev => ({ ...prev, [kind]: false })); }
    }
  };

  const totalResults = doctors.length + clinics.length;
  const visibleResults = type === 'doctors' ? doctors.length : type === 'clinics' ? clinics.length : totalResults;
  const resultLink = (kind: 'doctors' | 'clinics') => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (city) params.set('city', city);
    if (bookable) params.set(kind === 'clinics' ? 'bookable' : 'online', '1');
    return `/${kind}${params.size ? `?${params}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar & City Selector */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="w-full md:w-48 shrink-0">
          <select
            aria-label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full h-12 px-3 rounded-xl bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none"
          >
            <option value="">All Cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full flex-1 flex items-center bg-surface-container-low rounded-xl px-3 h-12">
          <Icon name="search" className="text-[20px] text-on-surface-variant shrink-0" />
          <input
            aria-label="Search doctors and clinics"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search doctors, clinics, specialties or hospitals..."
            className="flex-1 min-w-0 bg-transparent px-2 font-body-md text-body-md text-on-surface focus:outline-none"
          />
          {q && (
            <button aria-label="Clear search" onClick={() => setQ('')} className="p-1 text-on-surface-variant hover:text-on-surface">
              <Icon name="close" className="text-[18px]" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            aria-pressed={bookable}
            onClick={() => setBookable(!bookable)}
            className={`h-12 px-4 rounded-xl font-label-md text-label-md flex items-center gap-1.5 transition-colors ${
              bookable ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon name="confirmation_number" className="text-[18px]" />
            <span>Online token</span>
          </button>
        </div>
      </div>

      {/* Specialty recommendation banner if search matches a category */}
      {matchedGroup && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
              <Icon name="medical_services" className="text-[20px]" />
            </span>
            <div>
              <p className="font-label-lg text-label-lg text-on-surface">Browse all {matchedGroup.plural}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">View verified {matchedGroup.plural.toLowerCase()} with timings and address</p>
            </div>
          </div>
          <Link
            href={directoryPath(city || null, matchedGroup.slug)}
            className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md inline-flex items-center gap-1 shrink-0"
          >
            Explore {matchedGroup.name} <Icon name="arrow_forward" className="text-[16px]" />
          </Link>
        </div>
      )}

      {/* Type Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-container pb-3 overflow-x-auto">
        <button
          aria-pressed={type === 'all'}
          onClick={() => setType('all')}
          className={`h-9 px-4 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
            type === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          All ({totalResults}{doctorMore || clinicMore ? '+' : ''})
        </button>
        <button
          aria-pressed={type === 'doctors'}
          onClick={() => setType('doctors')}
          className={`h-9 px-4 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
            type === 'doctors' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Doctors ({doctors.length}{doctorMore ? '+' : ''})
        </button>
        <button
          aria-pressed={type === 'clinics'}
          onClick={() => setType('clinics')}
          className={`h-9 px-4 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
            type === 'clinics' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Clinics &amp; Hospitals ({clinics.length}{clinicMore ? '+' : ''})
        </button>
        {loading && <span className="font-body-sm text-body-sm text-on-surface-variant animate-pulse ml-2">Searching…</span>}
      </div>

      {failed && <div role="alert" className="rounded-xl bg-error-container text-on-error-container p-4 text-body-md">Search couldn’t be loaded. <button onClick={() => setRetry(v => v + 1)} className="underline min-h-11">Try again</button></div>}
      {/* Results Content */}
      {visibleResults === 0 && !loading && !failed && (
        <div className="bg-surface-container-lowest rounded-2xl p-10 text-center flex flex-col items-center gap-3">
          <Icon name="search_off" className="text-[48px] text-on-surface-variant" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{q ? `No matches found for “${q}”` : 'No results match these filters'}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
            Try searching by specialty (e.g., Dentist, Pediatrician), another city, or check for typos.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            <Link href="/doctors" className="h-10 px-4 rounded-xl bg-surface-container-low font-label-md text-label-md text-primary inline-flex items-center">
              All doctors
            </Link>
            <Link href="/clinics" className="h-10 px-4 rounded-xl bg-surface-container-low font-label-md text-label-md text-primary inline-flex items-center">
              All clinics
            </Link>
          </div>
        </div>
      )}

      {/* Doctors Section */}
      {(type === 'all' || type === 'doctors') && doctors.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Doctors</h2>
            <Link href={resultLink('doctors')} className="font-label-md text-label-md text-primary">
              View all doctors →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {doctors.map((d) => {
              const spec = groupOf(d.specialty)?.name ?? d.specialty;
              return (
                <Link
                  key={d.slug}
                  href={`/doctors/${d.slug}`}
                  className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3.5"
                >
                  {d.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(d.photo_url)} alt={d.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-surface-container-low text-primary flex items-center justify-center font-bold text-lg shrink-0">
                      {d.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-label-lg text-label-lg font-bold text-on-surface truncate">{d.name}</p>
                      {d.verified && <VerifiedBadge />}{d.booking_open && <OnlineTokenBadge />}
                    </div>
                    {spec && <p className="font-body-sm text-body-sm text-primary truncate">{spec}</p>}
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {[d.clinic_name, d.city].filter(Boolean).join(' · ')}
                    </p>

                  </div>
                </Link>
              );
            })}
          </div>
          {doctorMore && <ResultPageButton kind="doctors" busy={loadingPage.doctors} error={pageError === 'doctors'} onClick={() => loadMore('doctors')} />}
        </section>
      )}

      {/* Clinics Section */}
      {(type === 'all' || type === 'clinics') && clinics.length > 0 && (
        <section className="flex flex-col gap-3 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Clinics &amp; Hospitals</h2>
            <Link href={resultLink('clinics')} className="font-label-md text-label-md text-primary">
              View all clinics →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clinics.map((c) => (
              <Link
                key={c.slug}
                href={`/clinics/${c.slug}`}
                className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3.5"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-container-low text-primary flex items-center justify-center shrink-0">
                  <Icon name="local_hospital" className="text-[24px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><p className="font-label-lg text-label-lg font-bold text-on-surface truncate">{c.clinic_name}</p>{c.verified && <VerifiedBadge />}{c.booking_open && <OnlineTokenBadge />}</div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {[c.city, `${c.doctor_count} doctor${c.doctor_count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                  </p>

                </div>
              </Link>
            ))}
          </div>
          {clinicMore && <ResultPageButton kind="clinics" busy={loadingPage.clinics} error={pageError === 'clinics'} onClick={() => loadMore('clinics')} />}
        </section>
      )}
    </div>
  );
}

function ResultPageButton({ kind, busy, error, onClick }: { kind: 'doctors' | 'clinics'; busy: boolean; error: boolean; onClick: () => void }) {
  return <div className="flex flex-col items-center gap-2">
    {error && <p role="alert" className="text-body-sm text-error">More results couldn’t be loaded. Please try again.</p>}
    <button disabled={busy} onClick={onClick} className="min-h-11 px-5 rounded-xl bg-primary text-on-primary text-label-md disabled:opacity-50">{busy ? 'Loading…' : `${error ? 'Retry loading' : 'Load more'} ${kind}`}</button>
  </div>;
}
