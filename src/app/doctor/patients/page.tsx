'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type DailyPatientRow, type DailyPatientsResponse, type DoctorToday, type Tenant, type TokenStatus } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { inr, STATUS_LABEL, StatusPill, VitalsChips } from '@/components/staff/bits';
import { addDays, clinicToday } from '@/lib/clinicTime';
import { getQueueSocket } from '@/lib/socket';
import { PatientSearchAction } from '@/components/staff/PatientSearch';

export default function DoctorPatientsPage() {
  return (
    <StaffShell 
      variant="doctor" 
      active="/doctor/patients"
      headerAction={<PatientSearchAction />}
    >
      {({ tenant, doctor }) => <DoctorPatientsView tenant={tenant} doctor={doctor!} />}
    </StaffShell>
  );
}

type FilterStatus = 'all' | 'waiting' | 'in_consultation' | 'done' | 'cancelled';

function DoctorPatientsView({ tenant, doctor }: { tenant: Tenant; doctor: DoctorToday }) {
  const [date, setDate] = useState(clinicToday());
  const [data, setData] = useState<DailyPatientsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [exporting, setExporting] = useState(false);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.dailyPatients(date, doctor.id);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load patients for this date');
    } finally {
      setLoading(false);
    }
  }, [date, doctor.id]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Real-time updates when viewing today's queue
  useEffect(() => {
    if (date !== clinicToday()) return;
    const socket = getQueueSocket();
    const join = () => socket.emit('join_doctor_room', doctor.id);
    join();
    socket.on('connect', join);
    socket.on('queue:changed', loadPatients);
    socket.on('session:changed', loadPatients);
    return () => {
      socket.off('connect', join);
      socket.off('queue:changed', loadPatients);
      socket.off('session:changed', loadPatients);
    };
  }, [date, doctor.id, loadPatients]);

  const summary = data?.summary ?? {
    total: 0,
    done: 0,
    in_consultation: 0,
    waiting: 0,
    cancelled_or_no_show: 0,
    total_fee_inr: 0,
  };

  const filteredPatients = useMemo(() => {
    if (!data?.patients) return [];
    let list = data.patients;

    // Status filter
    if (statusFilter === 'waiting') {
      list = list.filter((p) => ['waiting_in_clinic', 'checked_in_early', 'booked'].includes(p.status));
    } else if (statusFilter === 'in_consultation') {
      list = list.filter((p) => p.status === 'in_consultation');
    } else if (statusFilter === 'done') {
      list = list.filter((p) => p.status === 'done');
    } else if (statusFilter === 'cancelled') {
      list = list.filter((p) => ['no_show', 'cancelled', 'expired'].includes(p.status));
    }

    // Text search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const cleanToken = q.replace(/^#/, '');
      list = list.filter((p) => {
        if (String(p.token_number) === cleanToken) return true;
        if (p.patient.name.toLowerCase().includes(q)) return true;
        if (p.patient.mobile_number.includes(q)) return true;
        if (p.chief_complaint?.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    return list;
  }, [data?.patients, statusFilter, searchQuery]);

  const handleExportCsv = () => {
    if (!data?.patients?.length) return;
    setExporting(true);
    try {
      exportPatientsCsv(data.patients, date, doctor.name);
    } finally {
      setExporting(false);
    }
  };

  const isToday = date === clinicToday();
  const readableDate = useMemo(() => {
    if (isToday) return 'Today';
    if (date === addDays(clinicToday(), -1)) return 'Yesterday';
    if (date === addDays(clinicToday(), 1)) return 'Tomorrow';
    try {
      return new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return date;
    }
  }, [date, isToday]);

  return (
    <div className="max-w-[1400px] flex flex-col gap-6">
      {/* Top Header & Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-surface-container/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Patients</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md">
              {readableDate}
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            View daily patient consultations, clinical vitals & export records for Dr. {doctor.name}
          </p>
        </div>

        {/* Controls: Date Navigator & Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-surface-container-low rounded-xl p-1 border border-surface-container/60 shadow-xs">
            <button
              onClick={() => setDate((d) => addDays(d, -1))}
              title="Previous Day"
              aria-label="Previous Day"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-lowest transition-colors"
            >
              <Icon name="chevron_left" className="text-[20px]" />
            </button>
            <button
              onClick={() => setDate(clinicToday())}
              disabled={isToday}
              className={`px-3 h-9 rounded-lg font-label-md text-label-md transition-colors ${
                isToday
                  ? 'bg-primary text-on-primary font-medium'
                  : 'text-on-surface-variant hover:bg-surface-container-lowest'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDate((d) => addDays(d, 1))}
              title="Next Day"
              aria-label="Next Day"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-lowest transition-colors"
            >
              <Icon name="chevron_right" className="text-[20px]" />
            </button>
          </div>

          <label className="flex items-center h-11 px-3 rounded-xl bg-surface-container-low border border-surface-container/60 cursor-pointer shadow-xs">
            <Icon name="calendar_today" className="text-on-surface-variant text-[18px] mr-2" />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="bg-transparent font-label-lg text-label-lg text-on-surface focus:outline-none cursor-pointer"
            />
          </label>

          <button
            onClick={handleExportCsv}
            disabled={!data?.patients?.length || exporting}
            className="h-11 px-4 rounded-xl bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-label-lg text-label-lg flex items-center gap-2 shadow-xs transition-all"
            title="Export patient records to CSV"
          >
            <Icon name="download" className="text-[20px]" />
            <span>Export CSV</span>
            {data?.patients?.length ? (
              <span className="ml-1 px-1.5 py-0.2 bg-on-primary/20 rounded-md text-label-sm font-bold">
                {data.patients.length}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container/40 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider">Total</span>
            <Icon name="groups" className="text-[20px]" />
          </div>
          <p className="font-headline-lg text-headline-lg text-on-surface">{summary.total}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">registered patients</p>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container/40 shadow-xs">
          <div className="flex items-center justify-between text-tertiary mb-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Completed</span>
            <Icon name="check_circle" className="text-[20px]" />
          </div>
          <p className="font-headline-lg text-headline-lg text-tertiary">{summary.done}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">consultations done</p>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container/40 shadow-xs">
          <div className="flex items-center justify-between text-primary mb-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">In Cabin</span>
            <Icon name="meeting_room" className="text-[20px]" />
          </div>
          <p className="font-headline-lg text-headline-lg text-primary">{summary.in_consultation}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">current patient</p>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container/40 shadow-xs">
          <div className="flex items-center justify-between text-secondary mb-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Waiting</span>
            <Icon name="hourglass_top" className="text-[20px]" />
          </div>
          <p className="font-headline-lg text-headline-lg text-secondary">{summary.waiting}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">in clinic or booked</p>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container/40 shadow-xs">
          <div className="flex items-center justify-between text-outline mb-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider">Cancelled</span>
            <Icon name="cancel" className="text-[20px]" />
          </div>
          <p className="font-headline-lg text-headline-lg text-outline">{summary.cancelled_or_no_show}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">no-show / removed</p>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container/40 shadow-xs">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider">Fees Paid</span>
            <Icon name="currency_rupee" className="text-[20px]" />
          </div>
          <p className="font-headline-lg text-headline-lg text-on-surface font-semibold">{inr(summary.total_fee_inr)}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">collected today</p>
        </div>
      </div>

      {/* Search and Filters Strip */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-surface-container/40 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient name, mobile, token #, complaint…"
            className="w-full h-11 pl-10 pr-9 rounded-xl bg-surface-container-low border border-surface-container/60 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {(
            [
              ['all', 'All', summary.total],
              ['waiting', 'Waiting', summary.waiting],
              ['in_consultation', 'In Cabin', summary.in_consultation],
              ['done', 'Done', summary.done],
              ['cancelled', 'Cancelled', summary.cancelled_or_no_show],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl font-label-md text-label-md flex items-center gap-1.5 transition-colors ${
                statusFilter === key
                  ? 'bg-primary text-on-primary font-medium shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span>{label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-label-sm ${
                  statusFilter === key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface'
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Patients Table / List */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container/40 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-on-surface-variant">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-body-md text-body-md">Loading patients for {readableDate}…</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-3 text-error">
            <Icon name="error_outline" className="text-[36px]" />
            <p className="font-headline-sm text-headline-sm">{error}</p>
            <button
              onClick={loadPatients}
              className="px-4 py-2 rounded-xl bg-error/10 text-error font-label-lg text-label-lg hover:bg-error/20"
            >
              Try again
            </button>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-on-surface-variant px-4">
            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant mb-1">
              <Icon name="person_search" className="text-[32px]" />
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface">No patients found</p>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'No patient records match your active search and filter criteria.'
                : `No patients registered for Dr. ${doctor.name} on ${readableDate}.`}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-surface-container-low text-primary font-label-lg text-label-lg hover:bg-surface-container"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-surface-container/60">
            {filteredPatients.map((row) => (
              <PatientRowCard key={row.visit_id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PatientRowCard({ row }: { row: DailyPatientRow }) {
  const p = row.patient;
  const timeStr = row.joined_at
    ? new Date(row.joined_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-surface-container-lowest/60 transition-colors">
      {/* Left Column: Token + Patient Identity */}
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-surface-container-low border border-surface-container/70 flex-shrink-0">
          <span className="font-headline-sm text-headline-sm font-bold text-primary">#{row.token_number}</span>
          <span className="text-[10px] text-on-surface-variant font-medium">{timeStr}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/doctor/consultation/${row.visit_id}`}
              className="font-headline-sm text-headline-sm text-on-surface hover:text-primary transition-colors font-semibold"
            >
              {p.name}
            </Link>
            <StatusPill status={row.status as TokenStatus} />
            {row.is_paid ? (
              <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed/40 text-on-tertiary-fixed-variant font-label-sm text-label-sm flex items-center gap-1">
                <Icon name="check" className="text-[14px]" /> Paid
              </span>
            ) : row.consultation_fee_inr > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-secondary-fixed/50 text-on-secondary-fixed-variant font-label-sm text-label-sm">
                Due {inr(row.consultation_fee_inr)}
              </span>
            ) : null}
          </div>

          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 flex items-center gap-2 flex-wrap">
            <span>
              {p.age ? `${p.age} yrs` : 'Age N/A'}
              {p.gender ? ` · ${p.gender}` : ''}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Icon name="call" className="text-[14px]" />
              {p.mobile_number || 'No phone'}
            </span>
            {row.called_at && (
              <>
                <span>·</span>
                <span className="text-outline">
                  Called at {new Date(row.called_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </>
            )}
          </p>

          {/* Chief Complaint */}
          {row.chief_complaint && (
            <p className="font-body-md text-body-md text-on-surface mt-2 italic bg-surface-container-low/50 px-3 py-1.5 rounded-xl border border-surface-container/40 inline-block max-w-2xl">
              &ldquo;{row.chief_complaint}&rdquo;
            </p>
          )}

          {/* Clinical Note Snippet (Doctor Only) */}
          {row.note && (
            <div className="mt-2 flex items-start gap-1.5 text-on-surface-variant font-body-sm text-body-sm max-w-2xl">
              <Icon name="clinical_notes" className="text-[16px] text-primary flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">
                <strong className="text-on-surface font-medium">Notes:</strong> {row.note}
              </span>
            </div>
          )}

          {/* Vitals */}
          {row.vitals && (
            <div className="mt-2.5">
              <VitalsChips vitals={row.vitals} />
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Fee Info & Action Link */}
      <div className="flex items-center gap-3 self-end md:self-center flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p className="font-label-md text-label-md text-on-surface font-semibold">
            {row.consultation_fee_inr ? inr(row.consultation_fee_inr) : 'Free'}
          </p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            {row.payment_method ? row.payment_method.replace('_', ' ') : row.is_paid ? 'Paid' : 'Unpaid'}
          </p>
        </div>

        <Link
          href={`/doctor/consultation/${row.visit_id}`}
          className="h-10 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary font-label-lg text-label-lg flex items-center gap-1.5 transition-colors border border-surface-container/60 shadow-xs"
        >
          <span>Consultation</span>
          <Icon name="arrow_forward" className="text-[18px]" />
        </Link>
      </div>
    </div>
  );
}

function exportPatientsCsv(patients: DailyPatientRow[], date: string, doctorName: string) {
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const formatVitals = (v: DailyPatientRow['vitals']) => {
    if (!v) return '';
    const parts: string[] = [];
    if (v.bp_systolic && v.bp_diastolic) parts.push(`BP: ${v.bp_systolic}/${v.bp_diastolic}`);
    if (v.weight_kg) parts.push(`Wt: ${v.weight_kg}kg`);
    if (v.height_cm) parts.push(`Ht: ${v.height_cm}cm`);
    if (v.temp_f) parts.push(`Temp: ${v.temp_f}F`);
    if (v.spo2_percent) parts.push(`SpO2: ${v.spo2_percent}%`);
    return parts.join('; ');
  };

  const headers = [
    'Token #',
    'Date',
    'Patient Name',
    'Mobile',
    'Age',
    'Gender',
    'Status',
    'Doctor',
    'Chief Complaint',
    'Vitals',
    'Doctor Notes',
    'Fee (INR)',
    'Payment Status',
    'Payment Method',
    'Time Joined',
    'Time Called',
  ];

  const rows = patients.map((p) => [
    `#${p.token_number}`,
    date,
    p.patient.name,
    p.patient.mobile_number,
    p.patient.age ?? '',
    p.patient.gender ?? '',
    STATUS_LABEL[p.status as TokenStatus] ?? p.status,
    p.doctor_name,
    p.chief_complaint ?? '',
    formatVitals(p.vitals),
    p.note ?? '',
    p.consultation_fee_inr,
    p.is_paid ? 'Paid' : 'Unpaid',
    p.payment_method ?? '',
    p.joined_at ? new Date(p.joined_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
    p.called_at ? new Date(p.called_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
  ]);

  const csvContent = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeDoctorName = doctorName.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `Patients_${safeDoctorName}_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
