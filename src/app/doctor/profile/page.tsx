'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { api, ApiError, type DoctorToday, type Tenant } from '@/lib/api';
import { Icon, DoctorAvatar } from '@/components/patient/ui';
import { ClinicDetails } from '@/components/clinic/ClinicDetails';

// A doctor's own public directory profile (clinicq.fit/doctors) — self-service, no admin needed. Every
// doctor can edit their own listing regardless of being the clinic admin; the clinic as a whole still
// needs its own switch on (Queue Rules -> Public directory) before any doctor there actually appears.
export default function DoctorProfilePage() {
  return (
    <StaffShell variant="doctor" active="/doctor/profile">
      {({ doctor, tenant, refreshTenant, me }) =>
        doctor ? (
          <div className="max-w-2xl flex flex-col gap-6 pb-10">
            <ProfileForm doctor={doctor} tenant={tenant} onSaved={refreshTenant} />
            {/* Address & listing moved here from Queue Rules; editable by the solo doctor or clinic admin (Decision 14). */}
            <ClinicDetails key={tenant.id} tenant={tenant} onSaved={refreshTenant} canEdit={me.user.can_manage_clinic} />
          </div>
        ) : null
      }
    </StaffShell>
  );
}

function ProfileForm({ doctor, tenant, onSaved }: { doctor: DoctorToday; tenant: Tenant; onSaved: () => Promise<void> }) {
  const [photoUrl, setPhotoUrl] = useState(doctor.photo_url ?? '');
  const [qualification, setQualification] = useState(doctor.qualification ?? '');
  const [specialty, setSpecialty] = useState(doctor.specialty ?? '');
  const [bio, setBio] = useState(doctor.bio ?? '');
  const [years, setYears] = useState(doctor.experience_years != null ? String(doctor.experience_years) : '');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [listed, setListed] = useState(!!doctor.is_publicly_listed);
  const [notifyLocationOverride, setNotifyLocationOverride] = useState(doctor.notify_location_override ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const dirty =
    photoUrl !== (doctor.photo_url ?? '') ||
    qualification !== (doctor.qualification ?? '') ||
    specialty !== (doctor.specialty ?? '') ||
    bio !== (doctor.bio ?? '') ||
    years !== (doctor.experience_years != null ? String(doctor.experience_years) : '') ||
    listed !== !!doctor.is_publicly_listed ||
    notifyLocationOverride !== (doctor.notify_location_override ?? '');

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      await api.updateDoctorPublicProfile(doctor.id, { 
        photo_url: photoUrl || '', 
        qualification, 
        specialty, 
        bio, 
        experience_years: years.trim() === '' ? null : Number(years),
        is_publicly_listed: listed,
        notify_location_override: notifyLocationOverride,
      });
      await onSaved();
      setState('saved');
    } catch (e) {
      setState('error');
      setError(e instanceof ApiError ? e.message : 'Could not save right now.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="px-2.5 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm uppercase">
          clinicq.fit/doctors
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
        <label className="flex flex-col gap-2 mb-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Profile Photo</span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <DoctorAvatar doctor={{ name: doctor.name, photo_url: photoUrl }} size="w-20 h-20" />
            <div className="flex flex-col items-start gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="photo-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setState('saving');
                  setError(null);
                  try {
                    const res = await api.uploadFile(file);
                    setPhotoUrl(res.url);
                    setState('idle');
                  } catch (err) {
                    setError('Failed to upload photo');
                    setState('error');
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <label htmlFor="photo-upload" className="h-10 px-4 rounded-lg border border-surface-container-high bg-surface flex items-center justify-center font-label-md cursor-pointer hover:bg-surface-container-low transition-colors">
                  Choose Image...
                </label>
                {photoUrl && (
                  <button onClick={() => setPhotoUrl('')} className="h-10 px-4 text-on-surface-variant hover:text-error transition-colors font-label-md">
                    Remove
                  </button>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant text-xs">JPG, PNG or GIF up to 5MB. Will be cropped to a circle.</p>
            </div>
          </div>
        </label>

        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="font-label-lg text-label-lg">List me in the public directory</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Patients can find and check in with you from clinicq.fit/doctors.</p>
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
          <span className="font-label-sm text-label-sm text-on-surface-variant">Years in practice (optional)</span>
          <input
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="12"
            className="h-11 w-32 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="font-body-sm text-body-sm text-on-surface-variant">Shown on your public page only if you fill it in.</span>
        </label>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Short bio</span>
          <button
            type="button"
            disabled={aiBusy}
            onClick={async () => {
              setAiBusy(true);
              setAiNote(null);
              try {
                // The draft uses what is already saved (name, qualification, specialty, years) — save first if you just changed them.
                setBio((await api.landingDoctorBio(doctor.id)).bio);
                setAiNote('Draft written — read it, change anything that is not right, then save.');
              } catch (e) {
                setAiNote(e instanceof ApiError ? e.message : 'Could not write a draft right now.');
              } finally {
                setAiBusy(false);
              }
            }}
            className="h-9 px-3 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-60"
          >
            <Icon name={aiBusy ? 'progress_activity' : 'auto_awesome'} className={`text-[18px] ${aiBusy ? 'animate-spin' : ''}`} />
            {aiBusy ? 'Writing…' : 'Write with AI'}
          </button>
        </div>
        {aiNote && <p className="font-body-sm text-body-sm text-on-surface-variant -mt-2">{aiNote}</p>}
        <label className="flex flex-col gap-1">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="A line or two patients searching online will see…"
            className="rounded-lg bg-surface-container-low px-3 py-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </label>

        {doctor.public_slug && listed && tenant.is_publicly_listed && (
          <div className="flex flex-col gap-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Your shareable link</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-0 h-11 rounded-lg bg-surface-container-low px-3 flex items-center">
                <span className="font-body-sm text-body-sm text-on-surface truncate">{origin || '…'}/doctors/{doctor.public_slug}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${origin}/doctors/${doctor.public_slug}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* clipboard blocked — the text is still right there to select */
                  }
                }}
                className="h-11 px-4 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 shrink-0"
              >
                <Icon name={copied ? 'check' : 'content_copy'} className="text-[18px]" /> {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Book a digital queue token with me on ClinicQ: ${origin}/doctors/${doctor.public_slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-4 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1.5 shrink-0"
              >
                <Icon name="share" className="text-[18px]" /> Share
              </a>
              <Link href={`/doctors/${doctor.public_slug}`} target="_blank" className="font-label-md text-label-md text-primary flex items-center gap-1.5">
                <Icon name="open_in_new" className="text-[18px]" /> View
              </Link>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Where patients find you (optional)</span>
          <input
            value={notifyLocationOverride}
            onChange={(e) => setNotifyLocationOverride(e.target.value)}
            placeholder={doctor.cabin_label ? `e.g. ${doctor.cabin_label}, 1st floor` : 'e.g. Room 101, 1st floor'}
            className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="font-body-sm text-body-sm text-on-surface-variant">Used in the “You are next” message instead of your cabin name.</span>
        </label>

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
