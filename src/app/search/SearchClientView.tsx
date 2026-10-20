'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/patient/ui';
import { api, fileUrl, type DirectoryDoctorSummary, type DirectoryClinicSummary } from '@/lib/api';
import { patientUrl } from '@/lib/clinicHost';
import { groupOf, groupBySlug, SPECIALTY_GROUPS, type SpecialtyGroup } from '@/lib/specialtyGroups';
import { OnlineTokenBadge } from '@/components/directory/OnlineTokenBadge';
import { VerifiedBadge } from '@/components/directory/VerifiedBadge';
import {
  GEO_PROMPT_DISMISSED_KEY,
  findClosestCity,
  reverseGeocodeCity,
  getStoredCity,
  setStoredCity,
} from '@/lib/directoryLocation';

// Every city listed today is in Bihar — shown next to the city on its own line so it never gets
// truncated along with a long street address. An unrecognised city just shows on its own, so this
// never mislabels a clinic once the directory expands past Bihar.
const BIHAR_CITIES = new Set(['patna', 'muzaffarpur', 'sitamarhi', 'harpur bakhri', 'rasulpur saidpur bazid']);
const stateOf = (city?: string | null) => (city && BIHAR_CITIES.has(city.trim().toLowerCase()) ? 'Bihar' : null);

// A doctor-run clinic is often named after the doctor ("Dr. Asha Sinha" clinic, doctor "Dr. Asha
// Sinha") or named "<Doctor> Clinic" — showing the detail line under the title then just repeats it.
// Strip "Dr."/"Dr" and common clinic-type suffixes, then compare.
const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/^dr\.?\s+/, '')
    .replace(/\s+(clinic|hospital|nursing home|polyclinic|care cent(?:re|er)|medical cent(?:re|er))$/, '')
    .replace(/\s+/g, ' ')
    .trim();
const sameName = (a?: string | null, b?: string | null) => !!a && !!b && normName(a) === normName(b);

type Kind = 'all' | 'doctors' | 'clinics';
interface Props {
  initialQ?: string; initialType?: Kind; initialCity?: string; initialArea?: string;
  initialToday?: boolean; initialBookable?: boolean; initialGroup?: string;
  initialDoctors?: DirectoryDoctorSummary[]; initialClinics?: DirectoryClinicSummary[];
  cities?: string[]; matchedGroup?: SpecialtyGroup | null; syncUrl?: boolean;
}
const PAGE_SIZE = 24;
const EMPTY_CITIES: string[] = [];
const EMPTY_DOCTORS: DirectoryDoctorSummary[] = [];
const EMPTY_CLINICS: DirectoryClinicSummary[] = [];
const DEFAULT_GROUPS = SPECIALTY_GROUPS.map(g => ({ slug: g.slug, name: g.name }));

export function SearchClientView({
  initialQ = '',
  initialType = 'all',
  initialCity = '',
  initialArea = '',
  initialToday = false,
  initialBookable = false,
  initialGroup = '',
  initialDoctors = EMPTY_DOCTORS,
  initialClinics = EMPTY_CLINICS,
  cities: suppliedCities = EMPTY_CITIES,
  syncUrl = true,
}: Props) {
  const resolvedInitialGroup = groupBySlug(initialGroup)?.slug || initialGroup;
  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState<Kind>(initialType);
  const [city, setCity] = useState(initialCity);
  const [area, setArea] = useState(initialArea);
  const [today, setToday] = useState(initialToday);
  const [bookable, setBookable] = useState(initialBookable);
  const [group, setGroup] = useState(resolvedInitialGroup);
  const [cities, setCities] = useState(suppliedCities);
  const [groups, setGroups] = useState<{ slug: string; name: string }[]>(DEFAULT_GROUPS);
  const [copied, setCopied] = useState(false);
  const [doctors, setDoctors] = useState(initialDoctors);
  const [clinics, setClinics] = useState(initialClinics);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState({ doctors: initialDoctors.length === PAGE_SIZE, clinics: initialClinics.length === PAGE_SIZE });
  const [loadingPage, setLoadingPage] = useState({ doctors: false, clinics: false });
  const [pageError, setPageError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  // Geolocation & Location prompt state
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  const locks = useRef({ doctors: false, clinics: false });
  const generation = useRef(0);

  // Handle City Change (persisting to localStorage)
  const handleCityChange = useCallback((newCity: string) => {
    setCity(newCity);
    setStoredCity(newCity || null);
    setShowLocationPrompt(false);
  }, []);

  // Detect location and match to nearest directory city
  const detectUserLocation = useCallback((userInitiated = false) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      if (userInitiated) {
        setLocationStatus('Location not supported');
        setTimeout(() => setLocationStatus(null), 3000);
      }
      return;
    }

    setDetectingLocation(true);
    setLocationStatus(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let matchedCity: string | null = null;

        // 1. Try reverse geocoding lookup
        const geoName = await reverseGeocodeCity(latitude, longitude);
        if (geoName && cities.length > 0) {
          const found = cities.find(
            (c) =>
              c.toLowerCase() === geoName.toLowerCase() ||
              geoName.toLowerCase().includes(c.toLowerCase()) ||
              c.toLowerCase().includes(geoName.toLowerCase())
          );
          if (found) matchedCity = found;
        }

        // 2. If not matched via reverse geocode, calculate closest city by coordinate distance
        if (!matchedCity && cities.length > 0) {
          matchedCity = findClosestCity(latitude, longitude, cities);
        }

        setDetectingLocation(false);
        setShowLocationPrompt(false);

        if (matchedCity) {
          handleCityChange(matchedCity);
          setLocationStatus(`📍 Set to ${matchedCity}`);
          setTimeout(() => setLocationStatus(null), 3500);
        } else if (userInitiated) {
          setLocationStatus('No clinics found near your GPS position');
          setTimeout(() => setLocationStatus(null), 3500);
        }
      },
      (err) => {
        setDetectingLocation(false);
        if (userInitiated) {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus('Location permission denied');
          } else {
            setLocationStatus('Could not get GPS location');
          }
          setTimeout(() => setLocationStatus(null), 3500);
        }
        setShowLocationPrompt(false);
        try {
          sessionStorage.setItem(GEO_PROMPT_DISMISSED_KEY, '1');
        } catch {}
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [cities, handleCityChange]);

  const dismissLocationPrompt = () => {
    setShowLocationPrompt(false);
    try {
      sessionStorage.setItem(GEO_PROMPT_DISMISSED_KEY, '1');
    } catch {}
  };

  // Restore city on mount, or prompt for location if no city chosen yet
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. If URL query has ?city=..., that takes precedence
    const urlParams = new URLSearchParams(window.location.search);
    const urlCity = urlParams.get('city');
    if (urlCity) {
      setCity(urlCity);
      setStoredCity(urlCity);
      return;
    }

    // 2. If initialCity was passed directly from route props (e.g. /doctors/in/patna)
    if (initialCity) {
      setStoredCity(initialCity);
      return;
    }

    // 3. Check if user already has a saved city in localStorage
    const saved = getStoredCity();
    if (saved) {
      setCity(saved);
      return;
    }

    // 4. No city selected: check if prompt was already dismissed in this session
    try {
      const dismissed = sessionStorage.getItem(GEO_PROMPT_DISMISSED_KEY);
      if (dismissed === '1') return;
    } catch {}

    // Show prompt banner and attempt geolocation detection
    setShowLocationPrompt(true);
    detectUserLocation(false);
  }, [initialCity, detectUserLocation]);

  useEffect(() => {
    let live = true;
    if (!suppliedCities.length) api.directoryCities().then(rows => { if (live) setCities(rows); }).catch(() => {});
    return () => { live = false; };
  }, [suppliedCities]);

  useEffect(() => {
    let live = true;
    api.directorySpecialtyGroups(city || undefined).then(rows => {
      if (!live) return;
      const seen = new Set<string>();
      const combined: { slug: string; name: string }[] = [];
      for (const r of rows) {
        if (!seen.has(r.slug)) {
          seen.add(r.slug);
          combined.push({ slug: r.slug, name: r.name });
        }
      }
      for (const dg of DEFAULT_GROUPS) {
        if (!seen.has(dg.slug)) {
          seen.add(dg.slug);
          combined.push(dg);
        }
      }
      setGroups(combined);
    }).catch(() => {});
    return () => { live = false; };
  }, [city]);

  // Keep URL synchronized without losing the current page pathname
  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return;
    const pathname = window.location.pathname;
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (type !== initialType && type !== 'all') params.set('type', type);
    else if (initialType === 'all' && type !== 'all') params.set('type', type);
    if (city) params.set('city', city);
    if (area.trim()) params.set('area', area.trim());
    if (today) params.set('today', '1');
    const isSpecialtyPage = pathname.includes('/specialty/');
    if (group && !isSpecialtyPage) params.set('specialty', group);
    if (bookable) params.set('online', '1');

    const searchStr = params.size ? `?${params.toString()}` : '';
    if (window.location.search !== searchStr) {
      window.history.replaceState(null, '', `${pathname}${searchStr}`);
    }
  }, [q, type, initialType, city, area, today, group, bookable, syncUrl]);

  const filters = () => ({
    q: q.trim() || undefined,
    group: group || undefined,
    city: city || undefined,
    area: area.trim() || undefined,
    today: today ? '1' : undefined,
    bookable: bookable ? '1' : undefined,
    limit: String(PAGE_SIZE),
  });

  useEffect(() => {
    const id = ++generation.current;
    setLoading(true); setFailed(false); setPageError(null);
    setMore({ doctors: false, clinics: false });
    locks.current = { doctors: false, clinics: false };
    setLoadingPage({ doctors: false, clinics: false });
    const timer = setTimeout(async () => {
      try {
        const common = {
          q: q.trim() || undefined,
          group: group || undefined,
          city: city || undefined,
          area: area.trim() || undefined,
          today: today ? '1' : undefined,
          bookable: bookable ? '1' : undefined,
          limit: String(PAGE_SIZE),
        };
        const [docs, cls] = await Promise.all([
          api.directorySearch(common),
          api.directoryClinicsSearch(common),
        ]);
        if (id !== generation.current) return;
        setDoctors(docs); setClinics(cls);
        setMore({ doctors: docs.length === PAGE_SIZE, clinics: cls.length === PAGE_SIZE });
      } catch { if (id === generation.current) { setFailed(true); setDoctors([]); setClinics([]); } }
      finally { if (id === generation.current) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); generation.current = id + 1; };
  }, [q, city, area, today, group, bookable, retry]);

  const loadMore = async (kind: 'doctors' | 'clinics') => {
    if (loading || locks.current[kind] || !more[kind]) return;
    const id = generation.current;
    locks.current[kind] = true;
    setLoadingPage(prev => ({ ...prev, [kind]: true })); setPageError(null);
    try {
      const common = {
        ...filters(),
        group: group || undefined,
        offset: String(kind === 'doctors' ? doctors.length : clinics.length),
      };
      if (kind === 'doctors') {
        const rows = await api.directorySearch(common);
        if (id !== generation.current) return;
        setDoctors(prev => [...prev, ...rows.filter(row => !prev.some(p => p.slug === row.slug))]);
        setMore(prev => ({ ...prev, doctors: rows.length === PAGE_SIZE }));
      } else {
        const rows = await api.directoryClinicsSearch(common);
        if (id !== generation.current) return;
        setClinics(prev => [...prev, ...rows.filter(row => !prev.some(p => p.slug === row.slug))]);
        setMore(prev => ({ ...prev, clinics: rows.length === PAGE_SIZE }));
      }
    } catch { if (id === generation.current) setPageError(kind); }
    finally { if (id === generation.current) { locks.current[kind] = false; setLoadingPage(prev => ({ ...prev, [kind]: false })); } }
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ClinicQ Search Results',
          url,
        });
        return;
      } catch {
        // User cancelled share or share sheet failed, fallback to clipboard
      }
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } catch {
        // Clipboard permission denied
      }
    }
  };

  const clear = () => {
    setQ('');
    handleCityChange('');
    setArea('');
    setGroup('');
    setToday(false);
    setBookable(false);
  };

  const count = type === 'doctors' ? doctors.length : type === 'clinics' ? clinics.length : doctors.length + clinics.length;
  const pill = (active: boolean) => `inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-label-md font-label-md transition-colors ${active ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/40 bg-transparent text-on-surface-variant hover:border-primary hover:text-primary'}`;
  const pagination = (kind: 'doctors' | 'clinics') => more[kind] && <div className="flex flex-col items-center gap-1 pt-1">{pageError === kind && <p role="alert" className="text-body-sm text-error">Couldn’t load more. Please try again.</p>}<button disabled={loading || loadingPage[kind]} onClick={() => loadMore(kind)} className="min-h-11 rounded-full border border-primary/25 px-5 text-label-md text-primary disabled:opacity-50">{loadingPage[kind] ? 'Loading…' : `Load more ${kind}`}</button></div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-surface-container-lowest p-3 sm:p-4 flex flex-col gap-3 shadow-sm border border-outline-variant/20">
        
        {/* Geolocation Prompt Banner */}
        {showLocationPrompt && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-on-surface">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                <Icon name="near_me" className="text-[20px]" />
              </span>
              <div className="min-w-0">
                <p className="text-label-md font-semibold text-on-surface">Find doctors near you</p>
                <p className="text-body-sm text-on-surface-variant truncate">Allow location access to show clinics and doctors in your city</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => detectUserLocation(true)}
                disabled={detectingLocation}
                className="h-8 px-3.5 rounded-lg bg-primary text-white text-label-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Icon name={detectingLocation ? 'refresh' : 'my_location'} className={`text-[16px] ${detectingLocation ? 'animate-spin' : ''}`} />
                <span>{detectingLocation ? 'Detecting…' : 'Use my location'}</span>
              </button>
              <button
                type="button"
                onClick={dismissLocationPrompt}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
                title="Dismiss"
                aria-label="Dismiss location prompt"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
          </div>
        )}

        {/* CITY SELECTION (KEPT AT TOP) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3 border-b border-surface-container">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center gap-1 text-primary font-semibold text-label-md shrink-0">
              <Icon name="location_on" className="text-[20px] text-primary" />
              <span>City:</span>
            </div>
            <div className="relative min-w-[170px] max-w-xs flex-1">
              <select
                aria-label="Select City"
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl bg-surface-container-low pl-3 pr-8 text-body-md font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer border border-outline-variant/30"
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
            </div>
            {city && (
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md bg-primary-fixed/30 text-primary text-label-sm font-medium">
                {stateOf(city) || 'Selected'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {locationStatus && (
              <span className="text-label-sm text-primary font-medium animate-pulse">
                {locationStatus}
              </span>
            )}
            <button
              type="button"
              onClick={() => detectUserLocation(true)}
              disabled={detectingLocation}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary text-label-sm font-medium transition-colors shrink-0 cursor-pointer disabled:opacity-60"
              title="Detect your city from GPS"
            >
              <Icon name={detectingLocation ? 'refresh' : 'near_me'} className={`text-[16px] ${detectingLocation ? 'animate-spin' : ''}`} />
              <span>{detectingLocation ? 'Detecting…' : 'Use current location'}</span>
            </button>
          </div>
        </div>

        {/* Category Pills (All / Doctors / Clinics) */}
        <div className="flex gap-1 rounded-xl bg-surface-container-low p-1 self-start" aria-label="Search category">
          {(['all', 'doctors', 'clinics'] as const).map(kind => (
            <button
              key={kind}
              aria-pressed={type === kind}
              onClick={() => setType(kind)}
              className={`h-9 px-4 rounded-lg text-label-md font-label-md transition-colors ${type === kind ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              {kind === 'all' ? 'All' : kind === 'doctors' ? 'Doctors' : 'Clinics'}
            </button>
          ))}
        </div>

        {/* Search Inputs Row (Doctor / Clinic Query + Area) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-2">
          <label className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3">
            <Icon name="search" className="text-[20px] text-primary shrink-0"/>
            <input
              aria-label="Search doctors and clinics"
              placeholder="Doctor, clinic or specialty"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="h-11 w-full min-w-0 bg-transparent text-body-md outline-none"
            />
            {q && (
              <button aria-label="Clear search" onClick={() => setQ('')} className="flex h-10 w-8 shrink-0 items-center justify-center text-on-surface-variant hover:text-on-surface">
                <Icon name="close" className="text-[18px]"/>
              </button>
            )}
          </label>
          <div className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3">
            <Icon name="near_me" className="text-[18px] text-on-surface-variant shrink-0" />
            <input
              aria-label="Area or landmark"
              placeholder="Area or landmark (e.g. Kankarbagh)"
              value={area}
              onChange={e => setArea(e.target.value)}
              className="h-11 w-full min-w-0 bg-transparent text-body-md outline-none"
            />
            {area && (
              <button aria-label="Clear area" onClick={() => setArea('')} className="flex h-10 w-8 shrink-0 items-center justify-center text-on-surface-variant hover:text-on-surface">
                <Icon name="close" className="text-[18px]"/>
              </button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          <button aria-pressed={bookable} onClick={() => setBookable(!bookable)} className={pill(bookable)}>
            <Icon name="confirmation_number" className="text-[17px]"/>
            Online token
          </button>
          <button aria-pressed={today} onClick={() => setToday(!today)} className={pill(today)}>
            <Icon name="today" className="text-[17px]"/>
            Available today
          </button>
          <div className="relative">
            <select
              aria-label="Specialty"
              value={group}
              onChange={e => setGroup(e.target.value)}
              className="h-9 min-w-0 max-w-full appearance-none rounded-full border border-outline-variant/40 bg-transparent pl-3 pr-7 text-label-md cursor-pointer hover:border-primary"
            >
              <option value="">All specialties</option>
              {groups.map(g => (
                <option value={g.slug} key={g.slug}>{g.name}</option>
              ))}
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant" />
          </div>
          {(q || city || area || group || today || bookable) && (
            <button onClick={clear} className="min-h-9 px-2 text-label-md text-primary underline underline-offset-4 cursor-pointer">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results header & count */}
      <div className="flex flex-wrap justify-between items-center gap-2 text-body-sm text-on-surface-variant" aria-live="polite">
        <span>{loading ? 'Updating results…' : `${count}${(type !== 'clinics' && more.doctors) || (type !== 'doctors' && more.clinics) ? '+' : ''} results${city ? ` in ${city}` : ''}`}</span>
        <div className="flex items-center gap-3">
          <span>Online booking clinics first</span>
          <button
            type="button"
            onClick={handleShare}
            title="Share or copy search link"
            aria-label="Share or copy search link"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-label-sm text-label-sm transition-colors cursor-pointer"
          >
            <Icon name={copied ? 'check' : 'share'} className="text-[16px]" />
            <span>{copied ? 'Link copied!' : 'Share search'}</span>
          </button>
        </div>
      </div>

      {failed && (
        <p role="alert" className="rounded-xl bg-error-container p-4 text-on-error-container">
          Search couldn’t be loaded. <button onClick={() => setRetry(v => v + 1)} className="min-h-11 underline">Try again</button>
        </p>
      )}

      {!loading && !failed && count === 0 && (
        <div className="rounded-2xl bg-white p-8 text-center">
          <h2 className="text-title-md">No results match these filters</h2>
          <p className="mt-2 text-body-md text-on-surface-variant">Try another name, area or city.</p>
          <button onClick={clear} className="mt-3 min-h-11 text-primary underline">Show all results</button>
        </div>
      )}

      {(type === 'all' || type === 'doctors') && doctors.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Doctor results">
          <h2 className="text-title-lg font-headline-sm">Doctors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-busy={loading}>
            {doctors.map(d => (
              <ResultCard
                key={d.slug}
                href={`/doctors/${d.slug}`}
                name={d.name}
                photo={d.photo_url}
                icon="stethoscope"
                subtitle={groupOf(d.specialty)?.name ?? d.specialty}
                detail={d.clinic_name}
                address={d.address}
                city={d.city}
                verified={d.verified}
                online={d.booking_open}
                phone={d.public_phone}
                isOpen24x7={d.is_open_24x7}
                emergencyPhone={d.emergency_phone}
                maps={d.maps_url}
                experienceYears={d.experience_years}
                booking={d.id && d.clinic_subdomain ? patientUrl(`/patient/${d.clinic_subdomain}/intake?doctorId=${encodeURIComponent(d.id)}`) : `/doctors/${d.slug}`}
              />
            ))}
          </div>
          {pagination('doctors')}
        </section>
      )}

      {(type === 'all' || type === 'clinics') && clinics.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Clinic results">
          <h2 className="text-title-lg font-headline-sm">Clinics &amp; hospitals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-busy={loading}>
            {clinics.map(c => (
              <ResultCard
                key={c.slug}
                href={`/clinics/${c.slug}`}
                name={c.clinic_name}
                icon="local_hospital"
                subtitle={c.specialties?.join(' · ')}
                detail={c.doctors?.length ? `${c.doctors[0].name}${c.doctor_count > 1 ? ` + ${c.doctor_count - 1} more` : ''}` : `${c.doctor_count} ${c.doctor_count === 1 ? 'doctor' : 'doctors'}`}
                address={c.address}
                city={c.city}
                verified={c.verified}
                online={c.booking_open}
                phone={c.public_phone}
                isOpen24x7={c.is_open_24x7}
                emergencyPhone={c.emergency_phone}
                website={c.website_url}
                maps={c.maps_url}
                booking={patientUrl(`/patient/${c.subdomain || c.slug}`)}
              />
            ))}
          </div>
          {pagination('clinics')}
        </section>
      )}
    </div>
  );
}

function ResultCard({ href, name, photo, icon, subtitle, detail, address, city, verified, online, phone, isOpen24x7, emergencyPhone, website, maps, booking, experienceYears }: { href: string; name: string; photo?: string | null; icon: string; subtitle?: string | null; detail?: string | null; address?: string | null; city?: string | null; verified?: boolean; online?: boolean; phone?: string | null; isOpen24x7?: boolean; emergencyPhone?: string | null; website?: string | null; maps?: string | null; booking: string; experienceYears?: number | null }) {
  const directions = maps && /^https?:\/\//i.test(maps) ? maps : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([detail && icon === 'stethoscope' ? detail : name, address, city].filter(Boolean).join(', '))}`;
  return (
    <article className="rounded-2xl bg-surface-container-lowest p-4 shadow-sm flex flex-col gap-2">
      <div className="flex gap-3 items-start">
        <Link href={href} tabIndex={-1} aria-hidden="true" className="shrink-0">
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={fileUrl(photo)} alt="" className="h-10 w-10 rounded-xl object-cover"/>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed/35 text-primary">
              <Icon name={icon} className="text-[22px]"/>
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={href} className="font-label-lg text-label-lg text-on-surface hover:text-primary line-clamp-2">
              {name}
            </Link>
            <span className="flex shrink-0 items-center gap-1">
              {verified && <VerifiedBadge size="sm"/>}
              {online && <OnlineTokenBadge/>}
              {isOpen24x7 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800" title="Open 24/7 (All the time)">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />24/7
                </span>
              )}
            </span>
          </div>
          {subtitle && <p className="mt-0.5 text-body-sm text-on-surface-variant truncate">{subtitle}</p>}
          {!!experienceYears && <p className="mt-0.5 text-body-sm text-on-surface-variant">{experienceYears}+ {experienceYears === 1 ? 'year' : 'years'} experience</p>}
        </div>
        <Link href={href} aria-label={`View ${name}`} className="text-on-surface-variant shrink-0">
          <Icon name="chevron_right" className="text-[20px]"/>
        </Link>
      </div>
      {detail && !sameName(detail, name) && <p className="text-body-sm text-on-surface truncate">{detail}</p>}
      {(address || city) && (
        <div className="flex gap-1 text-body-sm text-on-surface-variant">
          <Icon name="location_on" className="text-[16px] shrink-0 mt-0.5"/>
          <div className="min-w-0">
            {address && <p className="truncate" title={address}>{address}</p>}
            {city && <p className="truncate">{[city, stateOf(city)].filter(Boolean).join(', ')}</p>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-auto pt-1">
        {online && (
          <a href={booking} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 font-label-md text-label-md text-on-primary">
            Get token<Icon name="arrow_forward" className="text-[16px]"/>
          </a>
        )}
        {phone && (
          <a href={`tel:${phone}`} className="inline-flex min-h-11 items-center gap-1.5 text-label-md text-primary">
            <Icon name="call" className="text-[18px]"/>Call
          </a>
        )}
        {emergencyPhone && (
          <a href={`tel:${emergencyPhone}`} className="inline-flex min-h-11 items-center gap-1 text-label-md text-rose-700 font-semibold">
            <Icon name="emergency" className="text-[18px] text-rose-700"/>24/7 Helpline
          </a>
        )}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-label-md text-primary">
            <Icon name="language" className="text-[18px]"/>Website
          </a>
        )}
        {(address || maps) && (
          <a href={directions} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-label-md text-primary">
            <Icon name="near_me" className="text-[18px]"/>Directions
          </a>
        )}
      </div>
    </article>
  );
}
