'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// Clinic address / city / phone + the clinic-wide medqr.in listing switch. Lives on Public Profile
// (doctor portal) and Clinic Profile (clinic admin) — not in Queue Rules. Editable by whoever can
// manage the clinic (solo doctor or clinic admin, Decision 14); read-only for other doctors.

type ClinicDetailsPatch = { is_publicly_listed: boolean; city: string | null; address: string | null; public_phone: string | null };

export function ClinicDetails({
  tenant,
  onSaved,
  canEdit,
  save: saveFn = (patch) => api.updateTenantPublicProfile(tenant.id, patch),
}: {
  tenant: Tenant;
  onSaved: () => Promise<void>;
  canEdit: boolean;
  /** Platform admin passes its own save. */
  save?: (patch: ClinicDetailsPatch) => Promise<unknown>;
}) {
  const [listed, setListed] = useState(!!tenant.is_publicly_listed);
  const [city, setCity] = useState(tenant.city ?? '');
  const [address, setAddress] = useState(tenant.address ?? '');
  const [phone, setPhone] = useState(tenant.public_phone ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const dirty =
    listed !== !!tenant.is_publicly_listed || city !== (tenant.city ?? '') || address !== (tenant.address ?? '') || phone !== (tenant.public_phone ?? '');

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      await saveFn({ is_publicly_listed: listed, city: city || null, address: address || null, public_phone: phone || null });
      await onSaved();
      setState('saved');
    } catch (e) {
      setState('error');
      setError(e instanceof ApiError ? e.message : 'Could not save right now.');
    }
  };

  if (!canEdit) {
    // Other doctors in a multi-doctor clinic see the clinic's details; the clinic admin edits them (Decision 14).
    return (
      <Section title="Clinic details" subtitle="Set by your clinic admin.">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-body-md text-body-md">
          <dt className="text-on-surface-variant">Address</dt>
          <dd>{tenant.address || '—'}</dd>
          <dt className="text-on-surface-variant">City</dt>
          <dd>{tenant.city || '—'}</dd>
          <dt className="text-on-surface-variant">Phone</dt>
          <dd>{tenant.public_phone || '—'}</dd>
          <dt className="text-on-surface-variant">Listed online</dt>
          <dd>{tenant.is_publicly_listed ? 'Yes' : 'No'}</dd>
        </dl>
      </Section>
    );
  }

  return (
    <Section title="Clinic details" subtitle="Your clinic's address and phone, and whether it's listed on medqr.in/doctors for patients searching online.">
      <div className="flex flex-col gap-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="font-label-lg text-label-lg">List this clinic publicly</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Each doctor also needs their own listing switched on, from their Public Profile page.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Trivandrum" className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Public phone (optional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0471 234 5678" className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Address (optional)</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="2nd Floor, MG Road" className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </label>
        {tenant.public_slug && listed && (
          <Link href={`/clinics/${tenant.public_slug}`} target="_blank" className="font-label-md text-label-md text-primary flex items-center gap-1.5 self-start">
            <Icon name="open_in_new" className="text-[18px]" /> View your clinic&apos;s live page
          </Link>
        )}
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            disabled={!dirty || state === 'saving'}
            onClick={save}
            className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-40 self-start"
          >
            <Icon name="save" className="text-[20px]" />
            {state === 'saving' ? 'Saving…' : 'Save clinic details'}
          </button>
          {state === 'saved' && !dirty && <p className="font-body-sm text-body-sm text-tertiary">Saved ✓</p>}
        </div>
      </div>
    </Section>
  );
}


function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">{subtitle}</p>
      {children}
    </section>
  );
}
