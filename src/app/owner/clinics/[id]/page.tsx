'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api as publicApi, type CatalogAddOn, type DoctorToday, type QueueSettings, type Tenant } from '@/lib/api';
import { QueueRules, type QueueRulesHandle } from '@/components/clinic/QueueRules';
import { QueueSetupChat } from '@/components/clinic/QueueSetupChat';
import { ClinicDetails } from '@/components/clinic/ClinicDetails';
import { PatientNotifications } from '@/components/doctor/PatientNotifications';
import { IntakeFormEditor } from '@/components/doctor/IntakeFormEditor';
import type { AdminApi, SubscriptionStatusView } from '@/lib/adminApi';
import { DoctorsTab, LoginsTab, type TeamApi } from '@/components/team/TeamManager';
import { Icon } from '@/components/patient/ui';
import { clinicPageUrl } from '@/lib/clinicHost';
import { AdminShell } from '@/components/admin/AdminShell';
import { inr } from '@/components/staff/bits';
import { ArrivalQrCard } from '@/components/qr/ArrivalQrCard';
import { QrStandees } from '@/components/qr/QrStandees';
import { GatewaySetupTab } from '@/components/admin/GatewaySetupTab';
import { AdminSetupCard } from '@/components/setup/SetupCards';
import { clinicSiteUrl, patientUrl } from '@/lib/clinicHost';
import { toTitleCase } from '@/lib/titleCase';

// One clinic: doctors, their day-by-day consulting sessions (these drive the today-only
// availability chips, Decision 6), module switches (Decision 3 combines Prescription & Lab Reports AI
// under prescription_ocr at ₹399/mo), and manual WhatsApp-wallet credit until the payment gateway exists.
// Onboarding help: the platform admin can also set the clinic's address + Queue Rules ("Clinic &
// queue") and each doctor's Patient Notifications + Intake Form ("Doctor setup") — the same
// screens the clinic uses, saved through the admin API.

export default function AdminClinicPage() {
  return <AdminShell active="/owner/clinics">{(api, me) => <ClinicDetail api={api} referrer={me.role === 'referrer'} />}</AdminShell>;
}


/** referrer = Decision 27 referral partner: setup only — no deleting, billing, modules or wallet. */
function ClinicDetail({ api, referrer }: { api: AdminApi; referrer: boolean }) {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<'doctors' | 'setup' | 'clinic' | 'queue' | 'qr' | 'logins' | 'payments' | 'products' | 'modules'>('doctors');
  const [error, setError] = useState<string | null>(null);
  const queueRulesRef = useRef<QueueRulesHandle>(null);
  const team = useMemo(() => adminTeamApi(api, id, referrer, tenant?.queue_settings), [api, id, referrer, tenant?.queue_settings]);

  useEffect(() => {
    api.tenant(id).then(setTenant).catch((e: Error) => setError(e.message));
  }, [api, id]);

  if (error) return <p className="font-body-md text-body-md text-error">{error}</p>;
  if (!tenant) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/owner/clinics" className="flex items-center gap-1.5 text-primary font-label-md text-label-md self-start">
        <Icon name="arrow_back" className="text-[18px]" /> All clinics
      </Link>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <ClinicName api={api} tenant={tenant} onSaved={setTenant} />
        {!referrer && <ClinicCodeAndBooking api={api} tenant={tenant} onSaved={setTenant} />}
        <div className="flex flex-wrap gap-2 items-center">
          <a href={patientUrl(`/patient/${tenant.subdomain}`)} target="_blank" className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-2">
            <Icon name="smartphone" className="text-[18px]" /> Patient check-in page
          </a>
          <a href={clinicSiteUrl(tenant.subdomain, '/login') ?? `/login?clinic=${tenant.subdomain}`} target="_blank" className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-2">
            <Icon name="login" className="text-[18px]" /> Doctor/Staff Login page
          </a>
          <div className="flex-1" />
          {!referrer && (
          <button
            onClick={async () => {
              if (window.confirm(`Delete ${tenant.display_name || tenant.subdomain}? This removes the clinic and ALL its data (doctors, logins, queue, past patients).`)) {
                await api.deleteTenant(tenant.id);
                window.location.href = '/owner/clinics';
              }
            }}
            className="h-10 px-4 rounded-xl text-error bg-error-container/50 hover:bg-error-container font-label-md text-label-md flex items-center gap-2"
          >
            <Icon name="delete" className="text-[18px]" /> Delete clinic
          </button>
          )}
        </div>
      </section>

      {!referrer && <SubscriptionCard api={api} tenantId={tenant.id} />}

      <AdminSetupCard api={api} tenantId={tenant.id} referrer={referrer} goTab={setTab} />

      {/* Settings grouped by what they are about, so each one has one obvious home. */}
      <div className="flex flex-col gap-2">
        {(
          [
            ['People', [['doctors', 'Doctors & schedule'], ['setup', 'Doctor setup'], ['logins', 'Doctor/Staff Logins']]],
            ['Clinic', [['clinic', 'Profile & public page'], ['queue', 'Queue rules'], ['qr', 'QR codes']]],
            ['Money & plan', [['payments', 'Online payments'], ['products', 'Products'], ['modules', 'Plan, modules & wallet']]],
          ] as const
        ).map(([group, items]) => {
          const visible = items.filter(([k]) => !(referrer && (k === 'modules' || k === 'payments' || k === 'products')));
          if (!visible.length) return null;
          return (
            <div key={group} className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{group}</span>
              {visible.map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-4 py-2 rounded-full font-label-lg text-label-lg ${tab === k ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {tab === 'doctors' && (
        <div className="flex flex-col gap-4">
          {!referrer && <FindDetailsBar api={api} tenantId={tenant.id} />}
          <DoctorsTab api={team} />
        </div>
      )}
      {tab === 'products' && !referrer && <ProductsTab api={api} tenant={tenant} onSaved={setTenant} />}
      {tab === 'setup' && <DoctorSetupTab api={api} tenant={tenant} />}
      {tab === 'clinic' && (
        <div className="flex flex-col gap-6 pb-24">
          <ClinicDetails
            key={`details-${tenant.address}-${tenant.city}-${tenant.public_phone}-${tenant.emergency_phone}-${tenant.is_open_24x7}-${tenant.website_url}-${tenant.is_publicly_listed}`}
            tenant={tenant}
            canEdit
            onSaved={async () => setTenant(await api.tenant(tenant.id))}
            save={(patch) => api.updateTenant(tenant.id, patch)}
            aiDraft={() => api.landingDraft(tenant.id)}
          />
        </div>
      )}
      {tab === 'queue' && (
        <div className="flex flex-col gap-6 pb-24">
          {referrer && (
            <div>
              <p className="font-label-lg text-label-lg flex items-center gap-2 mb-2">
                <Icon name="auto_awesome" className="text-primary text-[20px]" /> Set up Queue Rules with the doctor
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
                Ask the doctor how their clinic runs and apply the answers to the form below — review and save, nothing is applied automatically.
              </p>
              <QueueSetupChat
                variant="inline"
                chat={(messages) => api.queueSetupChat(tenant.id, messages)}
                onRequestSetting={(description) => api.requestSetting(tenant.id, description)}
                onApply={(patch) => queueRulesRef.current?.applyPatch(patch)}
              />
            </div>
          )}
          <QueueRules
            ref={queueRulesRef}
            key={`rules-${JSON.stringify(tenant.queue_settings)}`}
            tenant={tenant}
            onSaved={async () => setTenant(await api.tenant(tenant.id))}
            save={(patch) => api.updateTenant(tenant.id, { queue_settings: patch })}
            chat={(messages) => api.queueSetupChat(tenant.id, messages)}
            requestSetting={(description) => api.requestSetting(tenant.id, description)}
            hideSetupButton={referrer}
          />
        </div>
      )}
      {tab === 'qr' && (
        <div className="flex flex-col gap-6 pb-24">
          <TenantQrStandees api={api} tenantId={tenant.id} />
          <ArrivalQrCard load={() => api.arrivalQr(tenant.id)} regenerate={() => api.regenerateArrivalQr(tenant.id)} rulesHint="Queue rules" />
        </div>
      )}
      {tab === 'logins' && <LoginsTab api={team} clinicCode={tenant.subdomain} />}
      {tab === 'payments' && !referrer && <GatewaySetupTab api={api} tenantId={tenant.id} clinicName={tenant.display_name ?? tenant.subdomain} />}
      {tab === 'modules' && !referrer && <ModulesTab api={api} tenant={tenant} onSaved={setTenant} />}
    </div>
  );
}

/** Decision 72 — look up this clinic's doctors (and its website / social pages) on Practo, Justdial etc.; results wait on Owner › Doctor details. */
function FindDetailsBar({ api, tenantId }: { api: AdminApi; tenantId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[220px]">
        <p className="font-label-lg text-label-lg">Find details online</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Searches Practo, Justdial and similar sites for this clinic&apos;s doctors, plus its website and social pages. You review before anything is saved.</p>
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true); setMsg(null);
          try { const r = await api.enrichClinicDoctors(tenantId); setMsg(`Searching for ${r.queued} doctor${r.queued === 1 ? '' : 's'}…`); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
        }}
        className="h-10 px-4 rounded-full bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60"
      >
        <Icon name="person_search" className="text-[18px]" /> Find details
      </button>
      {msg && <p className="w-full font-body-sm text-body-sm text-primary">{msg} <Link href="/owner/doctor-details" className="underline">Review results</Link></p>}
    </div>
  );
}

/** Pick a doctor, then set what they'd set themselves: Patient Notifications and Intake Form. */
function DoctorSetupTab({ api, tenant }: { api: AdminApi; tenant: Tenant }) {
  const [doctors, setDoctors] = useState<DoctorToday[] | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const load = async () => {
    const list = (await api.doctors(tenant.id)) as unknown as DoctorToday[];
    setDoctors(list);
    setDoctorId((cur) => cur || list[0]?.id || '');
  };
  useEffect(() => {
    load().catch(() => setDoctors([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  if (!doctors) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;
  if (!doctors.length) return <p className="font-body-md text-body-md text-on-surface-variant">Add a doctor first (Doctors &amp; schedule).</p>;
  const doctor = doctors.find((d) => d.id === doctorId) ?? doctors[0];

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 max-w-sm">
        <span className="font-label-md text-label-md">Doctor</span>
        <select value={doctor.id} onChange={(e) => setDoctorId(e.target.value)} className="h-11 rounded-lg bg-surface-container-lowest px-3 font-body-md text-body-md shadow-sm">
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <p className="font-body-sm text-body-sm text-on-surface-variant -mt-3">
        Hours are in “Doctors &amp; schedule”. Everything here is what the doctor can also change themselves under Settings.
      </p>
      <PatientNotifications
        key={`n-${doctor.id}`}
        doctor={doctor}
        tenant={tenant}
        title={`Patient Notifications — ${doctor.name}`}
        onSaved={load}
        save={(patch) => api.updateDoctorProfile(doctor.id, patch)}
      />
      <IntakeFormEditor
        key={`i-${doctor.id}`}
        doctor={doctor}
        title={`Intake Form — ${doctor.name}`}
        onSaved={load}
        save={(schema) => api.updateDoctorProfile(doctor.id, { intake_schema: schema })}
        saveLanguage={(lang) => api.updateDoctorProfile(doctor.id, { patient_language: lang })}
        clinicLanguage={tenant.queue_settings.patient_language}
      />
    </div>
  );
}

/** The main "scan to join" QR — distinct from the Arrival QR card below it. Same UI as /manage/qr. */
function TenantQrStandees({ api, tenantId }: { api: AdminApi; tenantId: string }) {
  const [doctors, setDoctors] = useState<DoctorToday[] | null>(null);
  useEffect(() => {
    api
      .doctors(tenantId)
      .then((list) => setDoctors(list as unknown as DoctorToday[]))
      .catch(() => setDoctors([]));
  }, [api, tenantId]);
  if (!doctors) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;
  return (
    <QrStandees
      doctors={doctors}
      list={() => api.tenantQrCodes(tenantId)}
      create={(body) => api.createTenantQrCode(tenantId, body)}
    />
  );
}

function adminTeamApi(api: AdminApi, tenantId: string, referrer: boolean, clinic?: QueueSettings): TeamApi {
  return {
    doctors: () => api.doctors(tenantId),
    createDoctor: (b) => api.createDoctor(tenantId, b),
    updateDoctor: (id, b) => api.updateDoctor(id, b),
    deleteDoctor: referrer ? undefined : (id) => api.deleteDoctor(id),
    schedule: (doctorId) => ({
      week: (from) => api.hoursWeek(doctorId, from),
      setDay: (date, slots) => api.setHoursDay(doctorId, date, slots),
      daysOff: (from, to) => api.setDaysOff(doctorId, from, to),
      getWeeklyTemplate: () => api.getWeeklyTemplate(doctorId),
      applyWeeklyTemplate: (weeks, template) => api.applyWeeklyTemplate(doctorId, weeks, template),
    }),
    users: () => api.users(tenantId),
    createUser: (b) => api.createUser(tenantId, b),
    updateUser: (id, b) => api.updateUser(id, b),
    resetPassword: (id) => api.resetPassword(id),
    setupLink: (id) => api.setupLink(id),
    deleteUser: referrer ? undefined : (id) => api.deleteUser(id),
    canGrantOwner: !referrer, // clinic admins are granted by ClinicQ only
    // Decision 28: super admin and the clinic's referrer set each doctor's own fee / payment / pacing.
    doctorSettings: { clinic: clinic ?? ({} as QueueSettings), save: (doctorId, patch) => api.updateDoctorSettings(doctorId, patch) },
    directoryFields: true,
  };
}

/**
 * Decision 60 — super admin only: shorten the clinic code (old code keeps working for links and staff
 * logins) and choose whether public pages offer "Get a token".
 */
function ClinicCodeAndBooking({ api, tenant, onSaved }: { api: AdminApi; tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const [code, setCode] = useState(tenant.subdomain);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => setCode(tenant.subdomain), [tenant.subdomain]);

  const save = async (body: { subdomain?: string; public_booking?: 'auto' | 'on' | 'off'; verified?: boolean }, msg: string) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      onSaved(await api.updateTenant(tenant.id, body));
      setSaved(msg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const booking = tenant.public_booking ?? 'auto';
  const changed = code.trim().toLowerCase() !== tenant.subdomain;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-surface-container pt-4">
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!changed) return;
          if (!window.confirm(`Change the clinic code to "${code.trim().toLowerCase()}"? Staff log in with the new code from now on; the old one keeps working.`)) return;
          save({ subdomain: code.trim().toLowerCase() }, 'Clinic code changed.');
        }}
      >
        <label className="font-label-md text-label-md">Clinic code</label>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 flex items-center bg-surface-container-low rounded-xl px-3 h-11 focus-within:ring-2 focus-within:ring-primary/30">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30))}
              className="flex-1 min-w-0 bg-transparent font-body-md text-body-md focus:outline-none"
              aria-label="Clinic code"
            />
            <span className="font-body-sm text-body-sm text-on-surface-variant">.clinicq.fit</span>
          </div>
          <button disabled={busy || !changed || code.trim().length < 3} className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md disabled:opacity-50">
            Save
          </button>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          3–30 letters, numbers or hyphens. Used for staff login and the clinic&apos;s address.
          {tenant.previous_subdomains?.length ? ` Old codes still work: ${tenant.previous_subdomains.join(', ')}.` : ''}
        </p>
      </form>
      <div className="flex flex-col gap-1.5">
        <span className="font-label-md text-label-md">&quot;Get a token&quot; on public pages</span>
        <div className="flex gap-1 bg-surface-container-low rounded-xl p-1 self-start">
          {(
            [
              ['auto', 'Auto'],
              ['on', 'Always on'],
              ['off', 'Off'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              onClick={() => v !== booking && save({ public_booking: v }, `"Get a token" set to ${label}.`)}
              className={`h-9 px-3 rounded-lg font-label-md text-label-md ${booking === v ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Auto = shown while the clinic is on a free trial or the paid plan; hidden on the free plan and when a trial ends unpaid.
        </p>
      </div>
      {/* Decision 68: Verified = ClinicQ checked the clinic's documents (set automatically when a claim/signup is approved). */}
      <label className="md:col-span-2 flex items-center gap-2 font-label-md text-label-md">
        <input type="checkbox" className="w-4 h-4" checked={!!tenant.verified_at} disabled={busy} onChange={(e) => save({ verified: e.target.checked }, e.target.checked ? 'Marked Verified.' : 'Verified badge removed.')} />
        Verified clinic (documents checked) — shows the badge and comes first in search
      </label>
      {(error || saved) && <p className={`md:col-span-2 font-body-sm text-body-sm ${error ? 'text-error' : 'text-tertiary'}`}>{error ?? saved}</p>}
    </div>
  );
}

/**
 * Decision 62 — super admin only: which ClinicQ products this clinic has opted for (QR Token System,
 * follow-ups, …). A tag for the Owner › Clinics product filter; it does not switch features or billing on.
 */
function ProductsTab({ api, tenant, onSaved }: { api: AdminApi; tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const [products, setProducts] = useState<{ key: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<string[]>(tenant.directory_products ?? []);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api.directoryProducts().then(setProducts).catch((e: Error) => setNote({ ok: false, text: e.message })); }, [api]);
  useEffect(() => setChosen(tenant.directory_products ?? []), [tenant.directory_products]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setNote({ ok: true, text: ok });
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const saved = [...(tenant.directory_products ?? [])].sort().join() === [...chosen].sort().join();
  const keyFor = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4 pb-6">
      <div>
        <h2 className="font-headline-sm text-headline-sm">Products this clinic uses</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Tick every ClinicQ product the clinic has opted for. Used to filter Owner › Clinics; it doesn&apos;t turn features or billing on.</p>
      </div>
      <div className="flex flex-col gap-2">
        {products.map((p) => (
          <label key={p.key} className="flex items-center gap-3 h-11 px-3 rounded-xl bg-surface-container-low font-body-md text-body-md cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={chosen.includes(p.key)} onChange={(e) => setChosen(e.target.checked ? [...chosen, p.key] : chosen.filter((k) => k !== p.key))} />
            {p.name}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={busy || saved}
        className="h-11 self-start px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-50"
        onClick={() => run(async () => onSaved(await api.updateTenant(tenant.id, { directory_products: chosen })), 'Products saved.')}
      >
        Save products
      </button>
      {!chosen.length && <p className="font-body-sm text-body-sm text-on-surface-variant">No product ticked: the clinic is a directory listing only (simple menu, no queue).</p>}
      <form
        className="flex flex-wrap gap-2 items-center border-t border-surface-container pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name || !keyFor(name)) return;
          run(async () => {
            const p = await api.createDirectoryProduct({ key: keyFor(name), name });
            setProducts(await api.directoryProducts());
            setChosen((c) => [...c, p.key]);
            setNewName('');
          }, `"${name}" added and ticked — press Save products.`);
        }}
      >
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New product, e.g. Follow-up System" className="h-11 flex-1 min-w-[220px] rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none" />
        <button disabled={busy || !keyFor(newName)} className="h-11 px-4 rounded-xl bg-surface-container text-primary font-label-md text-label-md disabled:opacity-50">Add product</button>
      </form>
      {note && <p className={`font-body-sm text-body-sm ${note.ok ? 'text-tertiary' : 'text-error'}`}>{note.text}</p>}
    </section>
  );
}

function ClinicName({ api, tenant, onSaved }: { api: AdminApi; tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tenant.display_name ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!editing)
    return (
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg">
            {tenant.clinic_number != null && <span className="text-on-surface-variant">#{tenant.clinic_number} </span>}
            {tenant.display_name ?? tenant.subdomain}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{tenant.subdomain}.clinicq.fit</p>
          {(() => {
            const t = tenant as Tenant & { website_url?: string | null; social_links?: Record<string, string> };
            const links = [...(t.website_url ? [['Website', t.website_url] as const] : []), ...Object.entries(t.social_links ?? {}).map(([k, u]) => [k.charAt(0).toUpperCase() + k.slice(1), u] as const)];
            return links.length ? <p className="font-body-sm text-body-sm text-on-surface-variant">{links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline mr-3">{label}</a>)}</p> : null;
          })()}
          {(() => {
            const page = clinicPageUrl(tenant);
            return (
              <a href={page.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary font-label-md text-label-md">
                <Icon name="open_in_new" className="text-[18px]" /> {page.listed ? 'View public page' : 'View clinic home (not in the directory yet)'}
              </a>
            );
          })()}
        </div>
        <button onClick={() => setEditing(true)} className="h-10 px-3 rounded-xl text-primary font-label-md text-label-md flex items-center gap-1">
          <Icon name="edit" className="text-[18px]" /> Rename
        </button>
      </div>
    );

  return (
    <form
      className="flex flex-col sm:flex-row gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const formatted = toTitleCase(name.trim());
          onSaved(await api.updateTenant(tenant.id, { display_name: formatted }));
          setEditing(false);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setName((n) => toTitleCase(n))}
        className="flex-1 h-12 rounded-xl bg-surface-container-low px-3 font-headline-sm text-headline-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button className="h-12 px-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg">Save</button>
      <button type="button" onClick={() => setEditing(false)} className="h-12 px-4 rounded-xl font-label-lg text-label-lg text-on-surface-variant">
        Cancel
      </button>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </form>
  );
}

// ---------------- Platform-fee trial / subscription (Decision 18) ----------------

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

const STATUS_LABEL: Record<SubscriptionStatusView['status'], { text: string; className: string }> = {
  free: { text: 'Free plan', className: 'bg-surface-container-high text-on-surface-variant' }, // Decision 59
  trial: { text: 'Free Trial', className: 'bg-blue-600 text-white' },
  active: { text: 'Paid', className: 'bg-tertiary text-white' },
  grace: { text: 'Grace period', className: 'bg-secondary text-white' },
  read_only: { text: 'Read-only (unpaid)', className: 'bg-error text-white' },
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function SubscriptionCard({ api, tenantId }: { api: AdminApi; tenantId: string }) {
  const [sub, setSub] = useState<SubscriptionStatusView | null>(null);
  const [days, setDays] = useState('14');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.subscription(tenantId).then(setSub).catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, tenantId]);

  const n = Number(days);
  const run = async (fn: () => Promise<SubscriptionStatusView>) => {
    setBusy(true);
    setError(null);
    try {
      setSub(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!sub) return null;
  const label = STATUS_LABEL[sub.status];
  const windowEnd = sub.status === 'grace' ? sub.grace_ends_at : sub.trial_ends_at;
  const left = daysLeft(windowEnd);

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-headline-sm text-headline-sm">Platform-fee subscription</h2>
          <span className={`px-3 py-1 rounded-full font-label-sm text-label-sm ${label.className}`}>{label.text}</span>
        </div>
        {sub.autopay_active && (
          <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
            <Icon name="autorenew" className="text-[16px]" /> Autopay set up
          </span>
        )}
      </div>

      {windowEnd && (
        <p className="font-body-md text-body-md text-on-surface-variant">
          {sub.status === 'grace' ? 'Grace period ends' : 'Trial ends'} {fmt(windowEnd)}
          {left !== null && ` (${left >= 0 ? `${left} day${left === 1 ? '' : 's'} left` : 'expired'})`}
        </p>
      )}
      {sub.status === 'active' && (
        <p className="font-body-md text-body-md text-on-surface-variant">
          {sub.current_period_end ? `Paid through ${fmt(sub.current_period_end)}` : 'Paid — no end date set'}
          {sub.autopay_active ? ' · autopay renews it each month' : ''}
        </p>
      )}
      {/* Decision 59: the free plan — full app, never billed; the clinic opts in by requesting a trial. */}
      {sub.status === 'free' && (
        <p className="font-body-md text-body-md text-on-surface-variant">
          Full app, free, never goes read-only.{' '}
          {sub.trial_requested_at ? (
            <strong className="text-amber-700">Asked for a free trial of the paid plan on {fmt(sub.trial_requested_at)} — start it below.</strong>
          ) : (
            'Not on a trial — the clinic can request one from its Billing page.'
          )}
        </p>
      )}
      {sub.status === 'read_only' && (
        <p className="font-body-md text-body-md text-error">Staff can view but not change anything for this clinic until it&apos;s marked active or given a grace period.</p>
      )}

      <div className="flex flex-wrap items-end gap-2 pt-1">
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Days</label>
          <input
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
            className="w-24 h-10 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {(sub.status === 'free' || sub.status === 'trial' || sub.status === 'read_only') && (
          <button
            disabled={busy || !n}
            onClick={() => run(() => api.extendTrial(tenantId, n))}
            className={`h-10 px-4 rounded-xl font-label-md text-label-md disabled:opacity-60 ${sub.status === 'free' ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-primary'}`}
          >
            {sub.status === 'free' ? 'Start free trial' : 'Extend trial'}
          </button>
        )}
        {sub.status === 'active' && (
          <button disabled={busy || !n} onClick={() => run(() => api.extendSubscription(tenantId, n))} className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md disabled:opacity-60">
            Extend subscription
          </button>
        )}
        {(sub.status === 'grace' || sub.status === 'read_only') && (
          <button disabled={busy || !n} onClick={() => run(() => api.grantGrace(tenantId, n))} className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md disabled:opacity-60">
            Give grace period
          </button>
        )}
        {sub.status !== 'active' && (
          <button disabled={busy} onClick={() => run(() => api.setSubscriptionActive(tenantId))} className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60">
            Mark active (paid offline)
          </button>
        )}
      </div>
      <CouponBox api={api} tenantId={tenantId} sub={sub} onChanged={load} />
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </section>
  );
}

// ---------------- Modules & wallet ----------------

function ModulesTab({ api, tenant, onSaved }: { api: AdminApi; tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const [catalog, setCatalog] = useState<CatalogAddOn[] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [walletMsg, setWalletMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [doctorCount, setDoctorCount] = useState<number | null>(null);
  const [override, setOverride] = useState(tenant.base_plan_override_inr != null ? String(tenant.base_plan_override_inr) : '');
  const [overrideMsg, setOverrideMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [overrideBusy, setOverrideBusy] = useState(false);

  useEffect(() => {
    publicApi.getBillingCatalog().then((c) => setCatalog(c.add_ons));
    api.doctors(tenant.id).then((ds) => setDoctorCount((ds as unknown as DoctorToday[]).length)).catch(() => setDoctorCount(null));
  }, [api, tenant.id]);

  const listBasePrice = 1199;

  const saveOverride = async (raw = override) => {
    setOverrideBusy(true);
    setOverrideMsg(null);
    try {
      const n = raw.trim() === '' ? null : Number(raw);
      if (n !== null && (!Number.isFinite(n) || n < 0)) throw new Error('Enter a positive amount, or leave blank to use the normal price');
      onSaved(await api.updateTenant(tenant.id, { base_plan_override_inr: n }));
      setOverrideMsg({ kind: 'ok', text: n === null ? 'Back to the normal tier price.' : `Custom base price set to ${inr(n)}/mo.` });
    } catch (e) {
      setOverrideMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setOverrideBusy(false);
    }
  };

  const toggle = async (key: string) => {
    setBusyKey(key);
    try {
      onSaved(await api.updateTenant(tenant.id, { entitlements: { [key]: !tenant.entitlements[key] } }));
    } finally {
      setBusyKey(null);
    }
  };

  const adjust = async (sign: 1 | -1) => {
    const n = Number(amount);
    if (!n) return;
    setWalletMsg(null);
    try {
      onSaved(await api.adjustWallet(tenant.id, sign * n));
      setWalletMsg({ kind: 'ok', text: `${sign > 0 ? 'Added' : 'Deducted'} ${inr(n)}.` });
      setAmount('');
    } catch (e) {
      setWalletMsg({ kind: 'error', text: (e as Error).message });
    }
  };

  const rows: { key: string; name: string; price: number | null }[] = [
    {
      key: 'base_plan_active',
      name: `Base platform (queue, reception, doctor console)${doctorCount !== null && doctorCount > 1 ? ' — up to 3 doctors' : ' — 1 doctor'}`,
      price: tenant.base_plan_override_inr ?? listBasePrice,
    },
    ...(catalog ?? []).map((a) => ({ key: a.key, name: a.name, price: a.price_inr_per_month })),
  ];

  const otpOn = tenant.queue_settings.require_whatsapp_otp !== false; // Decision 71: on by default

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm lg:col-span-2 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm">WhatsApp OTP at patient check-in</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Off (default) = patients type their details. On = WhatsApp verification is required when they submit the
            completed form. Verified numbers are remembered for 90 days. The doctor can change this in Queue Rules.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={otpOn}
          aria-label="Require WhatsApp OTP"
          disabled={busyKey === 'otp'}
          onClick={async () => {
            setBusyKey('otp');
            try {
              onSaved(await api.updateTenant(tenant.id, { require_whatsapp_otp: !otpOn }));
            } finally {
              setBusyKey(null);
            }
          }}
          className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 disabled:opacity-60 ${otpOn ? 'bg-primary' : 'bg-surface-container-high'}`}
        >
          <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${otpOn ? 'translate-x-6' : ''}`} />
        </button>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm lg:col-span-2 flex flex-col gap-3">
        <div>
          <h2 className="font-headline-sm text-headline-sm">Custom base price</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Normal price for this clinic is {inr(listBasePrice)}/mo (includes up to 3 doctors). Set a
            different amount for a negotiated deal — leave blank to use the normal price. Doctors past 3 still add ₹499/mo each.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-surface-container-low rounded-xl px-3 h-11">
            <span className="font-label-lg text-label-lg text-on-surface-variant">₹</span>
            <input
              inputMode="decimal"
              value={override}
              onChange={(e) => setOverride(e.target.value.replace(/[^\d]/g, ''))}
              placeholder={String(listBasePrice)}
              className="w-28 bg-transparent px-1 font-label-lg text-label-lg focus:outline-none"
            />
          </div>
          <button disabled={overrideBusy} onClick={() => saveOverride()} className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md disabled:opacity-50">
            {overrideBusy ? 'Saving…' : 'Save'}
          </button>
          {tenant.base_plan_override_inr != null && (
            <button
              disabled={overrideBusy}
              onClick={() => {
                setOverride('');
                saveOverride('');
              }}
              className="h-11 px-4 rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
        {overrideMsg && <p className={`font-body-sm text-body-sm ${overrideMsg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{overrideMsg.text}</p>}
      </section>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
        <h2 className="font-headline-sm text-headline-sm">Modules</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
          Switch modules on after the clinic pays. The clinic sees these on its Billing page.
        </p>
        {!catalog && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        <div className="flex flex-col divide-y divide-surface-container">
          {catalog &&
            rows.map((r) => {
              const on = !!tenant.entitlements[r.key];
              return (
                <div key={r.key} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-label-lg text-label-lg">{r.name}</p>
                    {r.price !== null && <p className="font-body-sm text-body-sm text-on-surface-variant">{inr(r.price)}/mo</p>}
                  </div>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={r.name}
                    disabled={busyKey === r.key}
                    onClick={() => toggle(r.key)}
                    className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 disabled:opacity-60 ${on ? 'bg-primary' : 'bg-surface-container-high'}`}
                  >
                    <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              );
            })}
        </div>
      </section>

      <aside className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3 self-start">
        <h2 className="font-headline-sm text-headline-sm">WhatsApp wallet</h2>
        <div className="bg-surface-container-low rounded-xl p-4">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Balance</p>
          <p className="font-numeric-metric text-numeric-metric">{inr(tenant.wallet_balance_inr)}</p>
        </div>
        <div className="flex items-center bg-surface-container-low rounded-xl px-3 h-12">
          <span className="font-label-lg text-label-lg text-on-surface-variant">₹</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="500"
            className="flex-1 bg-transparent px-1 font-headline-sm text-headline-sm focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => adjust(1)} className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md">
            Add credit
          </button>
          <button onClick={() => adjust(-1)} className="h-11 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md">
            Deduct
          </button>
        </div>
        {walletMsg && <p className={`font-body-sm text-body-sm ${walletMsg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{walletMsg.text}</p>}
        <p className="font-body-sm text-body-sm text-on-surface-variant">Manual adjustments until online recharge exists.</p>
      </aside>
    </div>
  );
}

/** Decision 36: the clinic's coupon (snapshot), apply / remove, and any autopay warning. */
function CouponBox({ api, tenantId, sub, onChanged }: { api: AdminApi; tenantId: string; sub: SubscriptionStatusView; onChanged: () => Promise<unknown> }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setCode('');
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const until = sub.discount_until ? new Date(sub.discount_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return (
    <div className="border-t border-surface-container pt-3 flex flex-col gap-2">
      {sub.billing_note && (
        <p className="bg-error-container/50 text-on-error-container rounded-xl p-3 font-body-sm text-body-sm flex items-start gap-2">
          <Icon name="warning" className="text-[18px] mt-0.5" /> {sub.billing_note}
        </p>
      )}
      {sub.coupon_code ? (
        <div className="flex items-center gap-3 flex-wrap">
          <Icon name="sell" className="text-[20px] text-secondary" />
          <p className="flex-1 font-body-md text-body-md">
            Coupon <strong>{sub.coupon_code}</strong>
            {sub.coupon_free_months ? ` · ${sub.coupon_free_months} free month${sub.coupon_free_months > 1 ? 's' : ''} added to the trial` : ''}
            {sub.coupon_percent_off ? ` · ${sub.coupon_percent_off}% off${until ? ` until ${until}` : ''}` : ''}
            {sub.coupon_applied_by ? <span className="text-on-surface-variant"> · by {sub.coupon_applied_by}</span> : null}
          </p>
          <button
            disabled={busy}
            onClick={() => window.confirm(`Remove ${sub.coupon_code}? The normal price applies from now (free months already given stay).`) && act(() => api.removeCoupon(tenantId))}
            className="h-10 px-4 rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md"
          >
            Remove coupon
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
            placeholder="Coupon code"
            className="h-10 w-44 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button disabled={busy || code.length < 3} onClick={() => act(() => api.applyCoupon(tenantId, code))} className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md disabled:opacity-60">
            Apply coupon
          </button>
        </div>
      )}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </div>
  );
}
