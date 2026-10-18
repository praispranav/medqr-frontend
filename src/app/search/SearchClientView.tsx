'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/patient/ui';
import { api, fileUrl, type DirectoryDoctorSummary, type DirectoryClinicSummary } from '@/lib/api';
import { directoryPath } from '@/lib/directoryServer';
import { groupOf, type SpecialtyGroup } from '@/lib/specialtyGroups';
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
  const [loading, setLoading] = useState(false);
  const firstRender = useRef(true);
  const searchId = useRef(0);

  useEffect(() => {
    // Update the browser URL bar so search is shareable/bookmarkable
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (type !== 'all') params.set('type', type);
    if (city) params.set('city', city);
    if (bookable) params.set('online', '1');
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);

    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const id = ++searchId.current;
    if (!q.trim() && !city) {
      setDoctors([]);
      setClinics([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [docs, cls] = await Promise.all([
          type === 'clinics' ? Promise.resolve([]) : api.directorySearch({ q: q.trim() || undefined, city: city || undefined, bookable: bookable ? '1' : undefined, limit: '30' }),
          type === 'doctors' ? Promise.resolve([]) : api.directoryClinicsSearch({ q: q.trim() || undefined, city: city || undefined, bookable: bookable ? '1' : undefined, limit: '30' }),
        ]);
        if (id === searchId.current) {
          setDoctors(docs);
          setClinics(cls);
        }
      } catch {
        if (id === searchId.current) {
          setDoctors([]);
          setClinics([]);
        }
      } finally {
        if (id === searchId.current) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [q, type, city, bookable]);

  const totalResults = doctors.length + clinics.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar & City Selector */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="w-full md:w-48 shrink-0">
          <select
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
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search doctors, clinics, specialties or hospitals..."
            className="flex-1 min-w-0 bg-transparent px-2 font-body-md text-body-md text-on-surface focus:outline-none"
          />
          {q && (
            <button onClick={() => setQ('')} className="p-1 text-on-surface-variant hover:text-on-surface">
              <Icon name="close" className="text-[18px]" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
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
          onClick={() => setType('all')}
          className={`h-9 px-4 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
            type === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          All ({totalResults})
        </button>
        <button
          onClick={() => setType('doctors')}
          className={`h-9 px-4 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
            type === 'doctors' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Doctors ({doctors.length})
        </button>
        <button
          onClick={() => setType('clinics')}
          className={`h-9 px-4 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
            type === 'clinics' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Clinics &amp; Hospitals ({clinics.length})
        </button>
        {loading && <span className="font-body-sm text-body-sm text-on-surface-variant animate-pulse ml-2">Searching…</span>}
      </div>

      {/* Results Content */}
      {totalResults === 0 && !loading && (q || city) && (
        <div className="bg-surface-container-lowest rounded-2xl p-10 text-center flex flex-col items-center gap-3">
          <Icon name="search_off" className="text-[48px] text-on-surface-variant" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">No matches found for &ldquo;{q}&rdquo;</h2>
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
            <Link href={`/doctors${q ? `?q=${encodeURIComponent(q)}` : ''}`} className="font-label-md text-label-md text-primary">
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
                      <VerifiedBadge />
                    </div>
                    {spec && <p className="font-body-sm text-body-sm text-primary truncate">{spec}</p>}
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {[d.clinic_name, d.city].filter(Boolean).join(' · ')}
                    </p>
                    {d.booking_open && (
                      <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm">
                        <Icon name="bolt" className="text-[14px]" /> Online token
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Clinics Section */}
      {(type === 'all' || type === 'clinics') && clinics.length > 0 && (
        <section className="flex flex-col gap-3 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Clinics &amp; Hospitals</h2>
            <Link href={`/clinics${q ? `?q=${encodeURIComponent(q)}` : ''}`} className="font-label-md text-label-md text-primary">
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
                  <p className="font-label-lg text-label-lg font-bold text-on-surface truncate">{c.clinic_name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {[c.city, `${c.doctor_count} doctor${c.doctor_count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                  </p>
                  {c.booking_open && (
                    <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm">
                      <Icon name="bolt" className="text-[14px]" /> Online token
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
