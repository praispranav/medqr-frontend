'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { api, ApiError, type DoctorToday, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// A doctor's own public directory profile (medqr.in/doctors) — self-service, no admin needed. Every
// doctor can edit their own listing regardless of being the clinic admin; the clinic as a whole still
// needs its own switch on (Queue Rules -> Public directory) before any doctor there actually appears.
export default function DoctorProfilePage() {
  return (
    <StaffShell variant="doctor" active="/doctor/profile">
      {({ doctor, tenant, refreshTenant }) => (doctor ? <ProfileForm doctor={doctor} tenant={tenant} onSaved={refreshTenant} /> : null)}
    </StaffShell>
  );
}

function ProfileForm({ doctor, tenant, onSaved }: { doctor: DoctorToday; tenant: Tenant; onSaved: () => Promise<void> }) {
  const [qualification, setQualification] = useState(doctor.qualification ?? '');
  const [specialty, setSpecialty] = useState(doctor.specialty ?? '');
  const [bio, setBio] = useState(doctor.bio ?? '');
  const [listed, setListed] = useState(!!doctor.is_publicly_listed);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const dirty =
    qualification !== (doctor.qualification ?? '') ||
    specialty !== (doctor.specialty ?? '') ||
    bio !== (doctor.bio ?? '') ||
    listed !== !!doctor.is_publicly_listed;

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      await api.updateDoctorPublicProfile(doctor.id, { qualification, specialty, bio, is_publicly_listed: listed });
      await onSaved();
      setState('saved');
    } catch (e) {
      setState('error');
      setError(e instanceof ApiError ? e.message : 'Could not save right now.');
    }
  };

  return (
    <div className="max-w-2xl flex flex-col gap-6 pb-10">
      <div>
        <span className="px-2.5 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm uppercase">
          medqr.in/doctors
        </span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mt-2">Your public profile</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          What patients searching for a doctor online see — separate from your dashboard, visible to no one until you list yourself.
        </p>
      </div>

      {!tenant.is_publicly_listed && (
        <div className="rounded-xl bg-secondary-container text-on-secondary-container px-4 py-3 flex items-start gap-2">
          <Icon name="info" className="text-[18px] mt-0.5 shrink-0" />
          <p className="font-body-sm text-body-sm">
            {tenant.display_name ?? 'Your clinic'} hasn&apos;t turned on the public directory yet — ask your clinic admin to switch it on in{' '}
            <Link href="/doctor/settings" className="underline">
              Queue Rules
            </Link>
            . Your own listing below won&apos;t appear until then.
          </p>
        </div>
      )}

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="font-label-lg text-label-lg">List me in the public directory</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Patients can find and check in with you from medqr.in/doctors.</p>
          </div>
          <button
            role="switch"
            aria-checked={listed}
            onClick={() => setListed((v) => !v)}
            className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${listed ? 'bg-primary' : 'bg-surface-container-high'}`}
          >
            <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${listed ? 'translate-x-6' : ''}`} />
          </button>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Qualification</span>
          <input
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            placeholder="MBBS, MD (Medicine)"
            className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Specialty</span>
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="General Physician"
            className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Short bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="A line or two patients searching online will see…"
            className="rounded-lg bg-surface-container-low px-3 py-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </label>

        {doctor.public_slug && listed && tenant.is_publicly_listed && (
          <Link href={`/doctors/${doctor.public_slug}`} target="_blank" className="font-label-md text-label-md text-primary flex items-center gap-1.5 self-start">
            <Icon name="open_in_new" className="text-[18px]" /> View my live public page
          </Link>
        )}

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            disabled={!dirty || state === 'saving'}
            onClick={save}
            className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-40"
          >
            <Icon name="save" className="text-[20px]" />
            {state === 'saving' ? 'Saving…' : 'Save profile'}
          </button>
          {state === 'saved' && !dirty && <p className="font-body-sm text-body-sm text-tertiary">Saved ✓</p>}
        </div>
      </section>
    </div>
  );
}
