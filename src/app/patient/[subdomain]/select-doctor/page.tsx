'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type AdvanceBookingDay, type DoctorToday, type DoctorTodayStatus, type Tenant } from '@/lib/api';
import {
  DoctorAvatar,
  DoctorStatusRow,
  nextSessionLabel,
  FullPageMessage,
  Icon,
  LoadingPage,
  PatientHeader,
} from '@/components/patient/ui';
import { useT } from '@/lib/i18n';
import { addDays, clinicToday } from '@/lib/clinicTime';
import { getQueueSocket } from '@/lib/socket';

// Tokens that no longer belong in "your tokens" (removed = Decision 26).
const FINISHED_TOKEN = new Set(['done', 'no_show', 'expired', 'cancelled']);

// Screen #1A — Doctor Selection / Confirmation. Ported from
// stitch_medqr_clinic_suite_ui_design/doctor_selection_confirmation_screen_1a/code.html.
// Variant A (one doctor) is a confirmation card; Variant B (polyclinic) is a pick-list with a
// sticky confirm bar, plus search once there are more than 6 doctors. The prototype
// state-switcher and the per-doctor "live cabin tracker" were dropped — no data behind them yet.
//
// Decision 17 — advance booking: a date strip appears only when the clinic allows booking ahead
// AND at least one doctor actually has a scheduled session on one of those days. Picking a future
// date swaps in that day's bookable doctors; their card shows "Consulting on {date}" instead of the
// live Decision-6 status row, since there's no live/break state for a day that hasn't started yet.

// Decision 6: only 'off_today' is non-selectable.
const isSelectable = (status: DoctorTodayStatus) => status !== 'off_today';

const formatDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  const tomorrow = addDays(clinicToday(), 1);
  if (iso === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function SelectDoctorPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [doctors, setDoctors] = useState<DoctorToday[] | null>(null);
  const [advanceDays, setAdvanceDays] = useState<AdvanceBookingDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // null = today
  const [error, setError] = useState<'not_found' | 'network' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTokens, setActiveTokens] = useState<any[]>([]);

  const { t } = useT(tenant?.queue_settings?.patient_language);

  useEffect(() => {
    const sync = async () => {
      try {
        const stored = JSON.parse(localStorage.getItem('medqr_patient_tokens') || '[]');
        const active = stored.filter((t: any) => !FINISHED_TOKEN.has(t.status));
        setActiveTokens(active.map((t: any) => ({...t, tokenNumber: t.number, patientName: t.patient_name, doctorName: t.doctor_name, doctorPhotoUrl: t.doctor_photo_url})));

        const verified: any[] = [];
        let updated = false;
        for (const t of active) {
          try {
            const data = await api.getToken(t.id);
            if (!FINISHED_TOKEN.has(data.status)) {
              verified.push({
                ...t,
                status: data.status,
                tokenNumber: data.token_number || t.number,
                patientName: data.patient_name || t.patient_name || "",
                doctorName: data.doctor?.name || t.doctor_name || "", doctorPhotoUrl: data.doctor?.photo_url || t.doctor_photo_url || ""
              });
            } else {
              updated = true; // Drop completed tokens
            }
          } catch(e) {
            // Keep it optimistic if network fails, unless it's a 404
            verified.push(t);
          }
        }
        setActiveTokens(verified);
        if (updated) {
           // Update localStorage to remove finished tokens from the active view
           const newStored = stored.map((s: any) => verified.find(v => v.id === s.id) || { ...s, status: 'done' });
           localStorage.setItem('medqr_patient_tokens', JSON.stringify(newStored));
        }
      } catch(e) {}
    };
    sync();
  }, []);


  useEffect(() => {
    (async () => {
      try {
        const t = await api.getTenantBySubdomain(subdomain);
        if (!t) return setError('not_found');
        setTenant(t);
        setDoctors(await api.getDoctorsToday(t.id));
        setTenantId(t.id);
        api
          .getAdvanceBooking(t.id)
          .then((r) => setAdvanceDays(r.days.filter((d) => d.doctors.length > 0)))
          .catch(() => undefined); // advance booking is a bonus — never block today's check-in on it
      } catch {
        setError('network');
      }
    })();
  }, [subdomain]);

  // Live: a doctor starting a shift, going on a break or having hours added flips their status here
  // without a reload — socket events from each doctor's room, plus a slow refresh for the clock
  // (a planned session starting) and when the patient comes back to the tab.
  const [tenantId, setTenantId] = useState<string | null>(null);
  const doctorKey = (doctors ?? []).map((d) => d.id).join(',');
  useEffect(() => {
    if (!tenantId) return;
    const refresh = () => api.getDoctorsToday(tenantId).then(setDoctors).catch(() => undefined);
    const socket = getQueueSocket();
    const join = () => doctorKey.split(',').filter(Boolean).forEach((id) => socket.emit('join_doctor_room', id));
    join();
    socket.on('connect', join);
    socket.on('queue:changed', refresh);
    socket.on('session:changed', refresh);
    const timer = setInterval(refresh, 60_000);
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      socket.off('connect', join);
      socket.off('queue:changed', refresh);
      socket.off('session:changed', refresh);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [tenantId, doctorKey]);

  /** Off today but bookable ahead (Decision 17 window) → jump to that day with this doctor picked. */
  const bookNext = (d: DoctorToday) => {
    if (!d.next_session?.bookable) return;
    setSelectedDate(d.next_session.date);
    setSelectedId(d.id);
  };

  const isFutureView = selectedDate !== null;
  // Unify today's real doctors and a future day's bookable doctors into one shape: presence in a
  // future day's list already means "has a real session" (Decision 17), so status is synthetic.
  const activeDoctors: DoctorToday[] = useMemo(() => {
    if (!isFutureView) return doctors ?? [];
    const day = advanceDays.find((d) => d.date === selectedDate);
    return (day?.doctors ?? []).map((d) => ({ ...d, today_status: 'available' as const, today_status_detail: '' }));
  }, [isFutureView, selectedDate, advanceDays, doctors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? activeDoctors.filter((d) => [d.name, d.specialty, d.cabin_label].some((f) => f?.toLowerCase().includes(q)))
      : activeDoctors;
    // Selectable doctors first; off-today ones sink to the bottom (never applies to a future day — all bookable).
    return [...list].sort((a, b) => Number(!isSelectable(a.today_status)) - Number(!isSelectable(b.today_status)));
  }, [activeDoctors, query]);

  if (error === 'not_found')
    return <FullPageMessage icon="wrong_location" title="Clinic not found" body="This QR code doesn't match a clinic on MedQR. Please ask the reception desk." />;
  if (error === 'network')
    return <FullPageMessage icon="wifi_off" title="Couldn't load the clinic" body="Check your internet connection and scan the QR code again." />;
  if (!tenant || !doctors) return <LoadingPage />;

  const clinicName = tenant.display_name ?? subdomain;
  const goToIntake = (doctorId: string) =>
    router.push(`/patient/${subdomain}/intake?doctorId=${doctorId}${selectedDate ? `&date=${selectedDate}` : ''}`);

  
  const activeTokensWidget = activeTokens.length > 0 ? (
    <div className="mt-2 flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-on-surface-variant px-1">
        <Icon name="confirmation_number" className="text-[18px]" />
        <h3 className="font-label-sm font-bold uppercase tracking-wider">Your Active Tokens</h3>
      </div>
      <div className="flex flex-col gap-2">
        {activeTokens.map(t => (
          <Link key={t.id} href={`/patient/${subdomain}/queue/${t.id}`} className="bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between shadow-sm active:scale-95 transition-transform border border-surface-container-low hover:border-primary/30 hover:shadow-md">
            <div className="flex items-center gap-3 min-w-0 pr-3">
              <DoctorAvatar doctor={{ name: t.doctorName || 'Doctor', photo_url: t.doctorPhotoUrl }} size="w-10 h-10" />
              <div className="flex flex-col min-w-0">
                <span className="font-label-lg font-bold text-on-surface truncate">{t.patientName}</span>
                <span className="font-body-sm text-on-surface-variant truncate">{t.doctorName}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-primary-container text-on-primary-container px-3 py-1 rounded-lg">
                <span className="font-label-lg font-bold">#{t.tokenNumber}</span>
              </div>
              <Icon name="chevron_right" className="text-on-surface-variant" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  ) : null;

  const dateStrip = advanceDays.length > 0 && (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
      <button
        onClick={() => {
          setSelectedDate(null);
          setSelectedId(null);
        }}
        className={`shrink-0 px-3.5 py-2 rounded-xl font-label-md text-label-md transition-colors ${
          !isFutureView ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant shadow-sm'
        }`}
      >
        Today
      </button>
      {advanceDays.map((d) => (
        <button
          key={d.date}
          onClick={() => {
            setSelectedDate(d.date);
            setSelectedId(null);
          }}
          className={`shrink-0 px-3.5 py-2 rounded-xl font-label-md text-label-md transition-colors ${
            selectedDate === d.date ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant shadow-sm'
          }`}
        >
          {formatDate(d.date)}
        </button>
      ))}
    </div>
  );

  if (activeDoctors.length === 0)
    return (
      <>
        <PatientHeader eyebrow="MedQR · Scanned ✓" title="Doctor Selection" />
        <main className="min-h-screen w-full max-w-[480px] mx-auto pt-16 pb-safe bg-surface">
          <div className="flex flex-col px-margin py-space-lg gap-space-md">
            
{dateStrip}
            <div className="flex flex-col items-center text-center gap-3 py-16">
              <Icon name="event_busy" className="text-[40px] text-on-surface-variant" />
              <p className="font-headline-sm text-headline-sm text-on-surface">
                {isFutureView ? `No doctor is scheduled on ${formatDate(selectedDate!)}` : 'No doctors listed today'}
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant">Please check with the reception desk at {clinicName}.</p>
            </div>
            {activeTokensWidget}
          </div>
        </main>
      </>
    );

  // ---------- Variant A: single bookable doctor for the selected day ----------
  if (activeDoctors.length === 1) {
    const d = activeDoctors[0];
    const selectable = isFutureView || isSelectable(d.today_status);
    return (
      <>
        <PatientHeader eyebrow="MedQR · Scanned ✓" title="Doctor Selection" />
        <main className="min-h-screen w-full max-w-[480px] mx-auto pt-16 pb-safe bg-surface">
          <div className="flex flex-col px-margin py-space-lg gap-space-lg">
            {dateStrip}
            <div className="flex flex-col gap-1">
              <span className="font-label-md text-label-md text-primary font-bold uppercase tracking-wider">OPD Express Check-in</span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-extrabold tracking-tight">
                {isFutureView ? t('booking_for', { name: d.name }) : t('checking_in_with', { name: d.name })}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {isFutureView ? `Confirm to get your token for ${formatDate(selectedDate!)}.` : 'Confirm the doctor to get your queue token.'}
              </p>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary-fixed/20 pointer-events-none" />
              <div className="flex items-center gap-space-md relative">
                <div className="relative flex-shrink-0">
                  <DoctorAvatar doctor={d} size="w-24 h-24" />
                  <div className="absolute bottom-0 right-0 bg-primary text-on-primary w-7 h-7 rounded-full flex items-center justify-center shadow-md">
                    <Icon name="check_circle" className="text-[16px]" />
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">{d.name}</span>
                  {d.qualification && (
                    <span className="font-label-md text-label-md text-on-surface-variant truncate">{d.qualification}</span>
                  )}
                  {d.specialty && (
                    <span className="font-label-sm text-label-sm text-primary font-semibold mt-0.5">{d.specialty}</span>
                  )}
                </div>
              </div>

              <div className="bg-surface-container-low rounded-lg p-space-sm flex items-start gap-2.5">
                <Icon name="apartment" className="text-primary text-[20px] mt-0.5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">{clinicName}</span>
                  {d.cabin_label && <span className="font-body-sm text-body-sm text-on-surface-variant">{d.cabin_label}</span>}
                </div>
              </div>

              {isFutureView ? (
                <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-lg">
                  <Icon name="event_available" className="text-[16px] text-primary" />
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">Consulting on {formatDate(selectedDate!)}</span>
                </div>
              ) : (
                <DoctorStatusRow status={d.today_status} detail={d.today_status_detail} next={d.next_session} />
              )}
            </div>

            <div className="flex items-center gap-2 px-1">
              <Icon name="verified_user" className="text-primary text-[18px]" />
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                No paper token needed. Your digital token is issued instantly.
              </span>
            </div>

            <div className="flex flex-col gap-space-sm pt-2">
              {!selectable && d.next_session?.bookable ? (
                <button
                  onClick={() => bookNext(d)}
                  className="w-full h-14 bg-primary text-on-primary font-label-lg text-label-lg rounded-xl flex items-center justify-center gap-2 shadow-md active:opacity-95 transition-all"
                >
                  <Icon name="event_available" className="text-[20px]" />
                  <span>Book for {nextSessionLabel(d.next_session)}</span>
                </button>
              ) : (
                <button
                  disabled={!selectable}
                  onClick={() => goToIntake(d.id)}
                  className="w-full h-14 bg-primary text-on-primary font-label-lg text-label-lg rounded-xl flex items-center justify-center gap-2 shadow-md active:opacity-95 transition-all disabled:opacity-40 disabled:shadow-none"
                >
                  <span>{selectable ? 'Confirm & Continue' : 'Not consulting today'}</span>
                  {selectable && <Icon name="arrow_forward" className="text-[20px]" />}
                </button>
              )}
              <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
                Wrong clinic? Scan the QR code again.
              </p>
            </div>
            {activeTokensWidget}
          </div>
        </main>
      </>
    );
  }

  // ---------- Variant B: polyclinic ----------
  const selected = activeDoctors.find((d) => d.id === selectedId) ?? null;
  const selectableCount = isFutureView ? activeDoctors.length : activeDoctors.filter((d) => isSelectable(d.today_status)).length;

  return (
    <>
      <PatientHeader eyebrow="MedQR · Scanned ✓" title="Doctor Selection" />
      <main className={`min-h-screen w-full max-w-[480px] mx-auto pt-16 bg-surface ${selected ? 'pb-48' : 'pb-safe'}`}>
        <div className="flex flex-col px-margin py-space-lg gap-space-md">
          {dateStrip}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-primary">
              <Icon name="local_hospital" className="text-[18px]" />
              <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider">{clinicName}</span>
              <Icon name="verified" className="text-[14px] text-tertiary" />
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface font-extrabold tracking-tight">
              Which doctor are you here to see?
            </h2>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {isFutureView
                ? `${selectableCount} doctor${selectableCount === 1 ? '' : 's'} consulting on ${formatDate(selectedDate!)} · Tap to select`
                : `${selectableCount} of ${activeDoctors.length} doctors consulting today · Tap to select`}
            </span>
          </div>

          {activeDoctors.length > 6 && (
            <div className="relative flex items-center">
              <Icon name="search" className="absolute left-3.5 text-on-surface-variant text-[20px]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search doctor, specialty, cabin..."
                className="w-full h-12 pl-11 pr-10 bg-surface-container-lowest rounded-xl font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant shadow-sm focus:outline-none focus:bg-surface-container-low transition-all"
              />
              {query && (
                <button aria-label="Clear search" className="absolute right-3 text-on-surface-variant" onClick={() => setQuery('')}>
                  <Icon name="close" className="text-[18px]" />
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-space-sm">
            {filtered.map((d) => {
              const selectable = isFutureView || isSelectable(d.today_status);
              const canBookAhead = !selectable && !!d.next_session?.bookable;
              const isSelected = d.id === selectedId;
              return (
                <button
                  key={d.id}
                  disabled={!selectable && !canBookAhead}
                  onClick={() => (canBookAhead ? bookNext(d) : setSelectedId(d.id))}
                  aria-pressed={isSelected}
                  className={`text-left rounded-xl p-space-md flex flex-col gap-space-xs transition-all ${
                    canBookAhead
                      ? 'bg-surface-container-low hover:shadow'
                      : !selectable
                      ? 'bg-surface-container-low opacity-70 cursor-not-allowed'
                      : isSelected
                        ? 'bg-primary-fixed/20 shadow-md ring-2 ring-primary'
                        : 'bg-surface-container-lowest shadow-sm hover:shadow'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <DoctorAvatar doctor={d} muted={!selectable} />
                      {isSelected && (
                        <div className="absolute -bottom-1 -right-1 bg-primary text-on-primary w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                          <Icon name="check" className="text-[14px]" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-label-lg text-label-lg font-bold text-on-surface truncate">{d.name}</span>
                        {d.cabin_label && (
                          <span className="font-label-sm text-label-sm text-on-surface-variant flex-shrink-0">{d.cabin_label}</span>
                        )}
                      </div>
                      <span
                        className={`font-body-sm text-body-sm font-semibold ${selectable ? 'text-primary' : 'text-on-surface-variant'}`}
                      >
                        {[d.qualification, d.specialty].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </div>
                  {isFutureView ? (
                    <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-lg self-start">
                      <Icon name="event_available" className="text-[14px] text-primary" />
                      <span className="font-label-sm text-label-sm text-on-surface">Consulting on {formatDate(selectedDate!)}</span>
                    </div>
                  ) : (
                    <DoctorStatusRow status={d.today_status} detail={d.today_status_detail} next={d.next_session} />
                  )}
                  {canBookAhead && (
                    <span className="self-start flex items-center gap-1 font-label-sm text-label-sm text-primary font-bold">
                      <Icon name="event_available" className="text-[14px]" /> Book for {nextSessionLabel(d.next_session!)}
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center font-body-md text-body-md text-on-surface-variant py-6">No doctor matches “{query}”.</p>
            )}
          </div>

          {activeTokensWidget}
          <p className="py-2 text-center font-label-md text-label-md text-on-surface-variant">
            Need assistance? Talk to {tenant?.queue_settings?.front_desk_verifies_arrivals === false ? 'the clinic staff' : 'the reception desk'}.
          </p>
        </div>
      </main>

      {selected && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md pb-safe shadow-[0_-8px_24px_rgba(19,27,46,0.06)]">
          <div className="max-w-[480px] mx-auto px-margin pt-3 pb-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Selected consultation</span>
                <span className="font-label-md text-label-md font-bold text-on-surface truncate">
                  {selected.name}
                  {selected.specialty ? ` (${selected.specialty})` : ''}
                </span>
              </div>
              <span
                className={`font-label-sm text-label-sm font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  isFutureView || selected.today_status === 'available'
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                    : 'bg-secondary-fixed text-on-secondary-fixed'
                }`}
              >
                {isFutureView
                  ? formatDate(selectedDate!)
                  : selected.today_status === 'available'
                    ? 'Available'
                    : selected.today_status === 'on_break'
                      ? 'On break'
                      : 'Later today'}
              </span>
            </div>
            <button
              onClick={() => goToIntake(selected.id)}
              className="w-full h-14 bg-primary text-on-primary font-label-lg text-label-lg rounded-xl flex items-center justify-center gap-2 shadow-md active:opacity-95 transition-all"
            >
              <span>Confirm &amp; Continue</span>
              <Icon name="arrow_forward" className="text-[20px]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
