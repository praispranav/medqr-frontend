'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminApi, TrialLead, TrialLeadStatus } from '@/lib/adminApi';
import { Icon } from '@/components/patient/ui';
import { AdminShell } from '@/components/admin/AdminShell';

// "Start free trial" submissions from the public landing page (Decision 18). Never creates a tenant by
// itself — the platform admin reviews each one here and onboards the clinic through Clinics -> Create.

export default function AdminLeadsPage() {
  return <AdminShell active="/owner/leads">{(api) => <Leads api={api} />}</AdminShell>;
}

const STATUS_LABEL: Record<TrialLeadStatus, { text: string; className: string }> = {
  new: { text: 'New', className: 'bg-primary-container text-on-primary-container' },
  contacted: { text: 'Contacted', className: 'bg-secondary-container text-on-secondary-container' },
  converted: { text: 'Converted', className: 'bg-tertiary-container text-white' },
  dismissed: { text: 'Dismissed', className: 'bg-surface-container text-on-surface-variant' },
};

function Leads({ api }: { api: AdminApi }) {
  const [leads, setLeads] = useState<TrialLead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<TrialLead | null>(null);

  const load = () => api.leads().then(setLeads).catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const setStatus = async (id: string, status: TrialLeadStatus) => {
    setBusyId(id);
    try {
      const updated = await api.setLeadStatus(id, status);
      setLeads((prev) => prev?.map((l) => (l.id === id ? updated : l)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-headline-lg text-headline-lg">Trial requests</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Clinics that submitted &quot;Start free trial&quot; on the landing page. Reviewing one doesn&apos;t create a clinic — do that from{' '}
          <Link href="/owner/clinics" className="text-primary underline">
            Clinics
          </Link>{' '}
          once you&apos;ve followed up.
        </p>
      </div>

      {error && <p className="font-body-md text-body-md text-error">{error}</p>}
      {leads === null && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {leads?.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">No trial requests yet.</p>}

      <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        {leads?.map((l) => (
          <div key={l.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-surface-container last:border-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-label-lg text-label-lg">{l.clinic_name}</p>
                <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${STATUS_LABEL[l.status].className}`}>{STATUS_LABEL[l.status].text}</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {l.contact_name} · +91 {l.phone}
                {l.email ? ` · ${l.email}` : ''}
                {l.city ? ` · ${l.city}` : ''}
              </p>
              {l.message && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">&quot;{l.message}&quot;</p>}
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{new Date(l.created_at).toLocaleString('en-IN')}</p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              {l.status !== 'converted' && (
                <button
                  onClick={() => setCreatingFor(l)}
                  className="h-9 px-3 rounded-full bg-primary text-on-primary font-label-sm text-label-sm flex items-center gap-1.5"
                >
                  <Icon name="add_business" className="text-[16px]" /> Create clinic
                </button>
              )}
              {(['contacted', 'converted', 'dismissed'] as const)
                .filter((s) => s !== l.status)
                .map((s) => (
                  <button
                    key={s}
                    disabled={busyId === l.id}
                    onClick={() => setStatus(l.id, s)}
                    className="h-9 px-3 rounded-full bg-surface-container-low text-on-surface font-label-sm text-label-sm disabled:opacity-60"
                  >
                    Mark {STATUS_LABEL[s].text.toLowerCase()}
                  </button>
                ))}
              <a href={`tel:+91${l.phone}`} className="h-9 w-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                <Icon name="call" className="text-[18px]" />
              </a>
            </div>
          </div>
        ))}
      </section>

      {creatingFor && (
        <CreateClinicFromLeadModal
          api={api}
          lead={creatingFor}
          onClose={() => setCreatingFor(null)}
          onCreated={(updated) => {
            setLeads((prev) => prev?.map((l) => (l.id === updated.id ? updated : l)) ?? null);
            setCreatingFor(null);
          }}
        />
      )}
    </div>
  );
}

/** Pre-fills the usual "Add a clinic" fields from the lead, then marks the lead converted on success. */
function CreateClinicFromLeadModal({
  api,
  lead,
  onClose,
  onCreated,
}: {
  api: AdminApi;
  lead: TrialLead;
  onClose: () => void;
  onCreated: (lead: TrialLead) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(lead.clinic_name);
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [city, setCity] = useState(lead.city ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggested = name
    .toLowerCase()
    .replace(/^dr\.?\s+/, 'dr')
    .replace(/'s\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);
  const effectiveCode = codeTouched ? code : suggested;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const tenant = await api.createTenant({ subdomain: effectiveCode, display_name: name, city: city.trim() || undefined });
      const updatedLead = await api.setLeadStatus(lead.id, 'converted');
      onCreated(updatedLead);
      router.push(`/owner/clinics/${tenant.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md">Create clinic from this request</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-on-surface-variant">
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Clinic name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Clinic code (web address)</span>
          <div className="flex items-center h-12 rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary/30">
            <input
              value={effectiveCode}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              }}
              placeholder="drsharma"
              className="flex-1 min-w-0 bg-transparent font-body-lg text-body-lg focus:outline-none"
            />
            <span className="font-body-md text-body-md text-on-surface-variant">.medqr.in</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">City (optional)</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <p className="font-body-sm text-body-sm text-on-surface-variant -mt-1">Starts on the default free trial — extend it from the clinic page after.</p>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button disabled={busy || !name.trim() || !effectiveCode} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40">
          {busy ? 'Creating…' : 'Create clinic & mark converted'}
        </button>
      </form>
    </div>
  );
}
