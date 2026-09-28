'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api as publicApi, type CatalogAddOn, type Tenant } from '@/lib/api';
import type { AdminApi, AdminDoctor, StaffLogin } from '@/lib/adminApi';
import { ScheduleEditor } from '@/components/schedule/ScheduleEditor';
import { Icon } from '@/components/patient/ui';
import { AdminShell } from '@/components/admin/AdminShell';
import { inr } from '@/components/staff/bits';

// One clinic: doctors, their day-by-day consulting sessions (these drive the today-only
// availability chips, Decision 6), module switches (Decision 3 keeps OCR and Image-to-Text
// separate), and manual WhatsApp-wallet credit until the payment gateway exists.

export default function AdminClinicPage() {
  return <AdminShell active="/admin/clinics">{(api) => <ClinicDetail api={api} />}</AdminShell>;
}


function ClinicDetail({ api }: { api: AdminApi }) {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<'doctors' | 'logins' | 'modules'>('doctors');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.tenant(id).then(setTenant).catch((e: Error) => setError(e.message));
  }, [api, id]);

  if (error) return <p className="font-body-md text-body-md text-error">{error}</p>;
  if (!tenant) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/clinics" className="flex items-center gap-1.5 text-primary font-label-md text-label-md self-start">
        <Icon name="arrow_back" className="text-[18px]" /> All clinics
      </Link>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <ClinicName api={api} tenant={tenant} onSaved={setTenant} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/patient/${tenant.subdomain}`} target="_blank" className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-2">
            <Icon name="smartphone" className="text-[18px]" /> Patient check-in page
          </Link>
          <Link href={`/login?clinic=${tenant.subdomain}`} target="_blank" className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-2">
            <Icon name="login" className="text-[18px]" /> Doctor/Staff Login page
          </Link>
        </div>
      </section>

      <div className="flex gap-2">
        {(
          [
            ['doctors', 'Doctors & schedule'],
            ['logins', 'Doctor/Staff Logins'],
            ['modules', 'Settings, modules & wallet'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full font-label-lg text-label-lg ${tab === k ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'doctors' && <DoctorsTab api={api} tenantId={tenant.id} />}
      {tab === 'logins' && <LoginsTab api={api} tenant={tenant} />}
      {tab === 'modules' && <ModulesTab api={api} tenant={tenant} onSaved={setTenant} />}
    </div>
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
          <h1 className="font-headline-lg text-headline-lg">{tenant.display_name ?? tenant.subdomain}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{tenant.subdomain}.medqr.in</p>
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
          onSaved(await api.updateTenant(tenant.id, { display_name: name }));
          setEditing(false);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="flex-1 h-12 rounded-xl bg-surface-container-low px-3 font-headline-sm text-headline-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      <button className="h-12 px-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg">Save</button>
      <button type="button" onClick={() => setEditing(false)} className="h-12 px-4 rounded-xl font-label-lg text-label-lg text-on-surface-variant">
        Cancel
      </button>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </form>
  );
}

// ---------------- Doctors & schedule ----------------

type DoctorForm = { name: string; qualification: string; specialty: string; cabin_label: string };
const emptyDoctor: DoctorForm = { name: '', qualification: '', specialty: '', cabin_label: '' };

function DoctorsTab({ api, tenantId }: { api: AdminApi; tenantId: string }) {
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const list = await api.doctors(tenantId);
    setDoctors(list);
    setSelectedId((cur) => (cur && list.some((d) => d.id === cur) ? cur : (list[0]?.id ?? null)));
  }, [api, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!doctors) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;
  const selected = doctors.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6">
      <section className="flex flex-col gap-3">
        {doctors.map((d) =>
          editingId === d.id ? (
            <DoctorEditor
              key={d.id}
              initial={{ name: d.name, qualification: d.qualification ?? '', specialty: d.specialty ?? '', cabin_label: d.cabin_label ?? '' }}
              submitLabel="Save"
              onCancel={() => setEditingId(null)}
              onSubmit={async (f) => {
                await api.updateDoctor(d.id, f);
                setEditingId(null);
                await load();
              }}
            />
          ) : (
            <div
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`rounded-2xl p-4 cursor-pointer flex items-start gap-3 ${d.id === selectedId ? 'bg-primary-fixed/20 ring-2 ring-primary' : 'bg-surface-container-lowest shadow-sm'}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-label-lg text-label-lg truncate">{d.name}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {[d.qualification, d.specialty, d.cabin_label].filter(Boolean).join(' · ') || 'No details yet'}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(d.id);
                }}
                aria-label={`Edit ${d.name}`}
                className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <Icon name="edit" className="text-[18px]" />
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!window.confirm(`Remove ${d.name} and their schedule? Past visits are kept.`)) return;
                  await api.deleteDoctor(d.id);
                  await load();
                }}
                aria-label={`Remove ${d.name}`}
                className="w-9 h-9 rounded-lg hover:bg-error-container hover:text-error flex items-center justify-center text-on-surface-variant"
              >
                <Icon name="delete" className="text-[18px]" />
              </button>
            </div>
          ),
        )}
        {doctors.length === 0 && !adding && (
          <p className="font-body-md text-body-md text-on-surface-variant">No doctors yet. Patients can&apos;t check in until you add one with a session today.</p>
        )}
        {adding ? (
          <DoctorEditor
            initial={emptyDoctor}
            submitLabel="Add doctor"
            onCancel={() => setAdding(false)}
            onSubmit={async (f) => {
              const d = await api.createDoctor(tenantId, f);
              setAdding(false);
              await load();
              setSelectedId(d.id);
            }}
          />
        ) : (
          <button onClick={() => setAdding(true)} className="h-12 rounded-xl border border-dashed border-outline-variant text-primary font-label-lg text-label-lg flex items-center justify-center gap-2 hover:bg-surface-container-low">
            <Icon name="person_add" className="text-[20px]" /> Add doctor
          </button>
        )}
      </section>

      {selected ? (
        <ScheduleEditor
          key={selected.id}
          title={selected.name}
          api={{
            list: (date) => api.sessions(selected.id, date),
            add: (body) => api.addSession(selected.id, body),
            repeat: (from, days) => api.repeatSchedule(selected.id, from, days),
            setActive: (id, active) => api.setSessionActive(id, active),
            remove: (id) => api.deleteSession(id),
          }}
        />
      ) : (
        <section className="bg-surface-container-low rounded-2xl p-8 text-center font-body-md text-body-md text-on-surface-variant">
          Add a doctor to set their consulting hours.
        </section>
      )}
    </div>
  );
}

function DoctorEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: DoctorForm;
  submitLabel: string;
  onSubmit: (f: DoctorForm) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof DoctorForm, label: string, ph: string) => (
    <label className="flex flex-col gap-1">
      <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
      <input
        value={f[k]}
        placeholder={ph}
        onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))}
        className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSubmit(f);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
      className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-3"
    >
      {field('name', 'Name *', 'Dr. Meera Sharma')}
      <div className="grid grid-cols-2 gap-2">
        {field('qualification', 'Qualification', 'MBBS, MD')}
        {field('cabin_label', 'Cabin', 'Cabin 2')}
      </div>
      {field('specialty', 'Specialty', 'Pediatrician')}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy || !f.name.trim()} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md disabled:opacity-40">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg font-label-md text-label-md text-on-surface-variant">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------- Staff logins ----------------

function LoginsTab({ api, tenant }: { api: AdminApi; tenant: Tenant }) {
  const [logins, setLogins] = useState<StaffLogin[] | null>(null);
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [role, setRole] = useState<'reception' | 'doctor'>('reception');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const [u, d] = await Promise.all([api.users(tenant.id), api.doctors(tenant.id)]);
    setLogins(u);
    setDoctors(d);
  }, [api, tenant.id]);

  useEffect(() => {
    load();
  }, [load]);

  const doctorName = (id: string | null) => doctors.find((d) => d.id === id)?.name ?? '—';
  const doctorsWithoutLogin = doctors.filter((d) => !logins?.some((l) => l.doctor_id === d.id));

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      await load();
      setMsg({ kind: 'ok', text: ok });
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  };

  const create = () =>
    act(async () => {
      await api.createUser(tenant.id, { role, name, username, password, doctor_id: role === 'doctor' ? doctorId : null });
      setName('');
      setUsername('');
      setPassword('');
      setDoctorId('');
    }, `Login created. Share the clinic code “${tenant.subdomain}”, the username and the password with them.`);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden self-start">
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-headline-sm text-headline-sm">Who can log in</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Reception and doctors have separate logins. Staff sign in at <strong>/login</strong> with clinic code{' '}
            <strong>{tenant.subdomain}</strong>.
          </p>
        </div>
        {logins === null && <p className="px-5 pb-5 font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        {logins?.length === 0 && <p className="px-5 pb-5 font-body-md text-body-md text-on-surface-variant">No logins yet — create one on the right.</p>}
        {logins?.map((l) => (
          <div key={l.id} className={`px-5 py-4 border-t border-surface-container flex items-center gap-3 flex-wrap ${l.is_active ? '' : 'opacity-60'}`}>
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${l.role === 'doctor' ? 'bg-primary-fixed/50 text-primary' : 'bg-secondary-fixed text-on-secondary-fixed'}`}>
              <Icon name={l.role === 'doctor' ? 'stethoscope' : 'desk'} className="text-[22px]" />
            </span>
            <div className="flex-1 min-w-[160px]">
              <p className="font-label-lg text-label-lg">
                {l.name} <span className="font-body-sm text-body-sm text-on-surface-variant">@{l.username}</span>
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {l.role === 'doctor' ? `Doctor · ${doctorName(l.doctor_id)}` : 'Reception'}
                {' · '}
                {l.is_active ? (l.last_login_at ? `last login ${new Date(l.last_login_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'never logged in') : 'deactivated'}
              </p>
            </div>
            <button
              onClick={() => {
                const pw = window.prompt(`New password for @${l.username} (min 8 characters). They will be signed out everywhere.`);
                if (pw) act(() => api.updateUser(l.id, { password: pw }), `Password reset for @${l.username}.`);
              }}
              className="h-9 px-3 rounded-lg bg-surface-container-low font-label-md text-label-md text-primary"
            >
              Reset password
            </button>
            <button
              onClick={() => act(() => api.updateUser(l.id, { is_active: !l.is_active }), l.is_active ? `@${l.username} can no longer log in.` : `@${l.username} can log in again.`)}
              className="h-9 px-3 rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface-variant"
            >
              {l.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete the login @${l.username}? This can't be undone.`)) act(() => api.deleteUser(l.id), `Deleted @${l.username}.`);
              }}
              aria-label={`Delete login ${l.username}`}
              className="w-9 h-9 rounded-lg hover:bg-error-container hover:text-error flex items-center justify-center text-on-surface-variant"
            >
              <Icon name="delete" className="text-[18px]" />
            </button>
          </div>
        ))}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3 self-start"
      >
        <h2 className="font-headline-sm text-headline-sm">New login</h2>
        <div className="grid grid-cols-2 gap-2">
          {(['reception', 'doctor'] as const).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={`h-11 rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 ${role === r ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}
            >
              <Icon name={r === 'doctor' ? 'stethoscope' : 'desk'} className="text-[18px]" />
              {r === 'doctor' ? 'Doctor' : 'Reception'}
            </button>
          ))}
        </div>
        {role === 'doctor' && (
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Which doctor</span>
            <select
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value);
                const d = doctors.find((x) => x.id === e.target.value);
                if (d && !name) setName(d.name);
              }}
              className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md"
            >
              <option value="">Select…</option>
              {doctorsWithoutLogin.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {doctorsWithoutLogin.length === 0 && (
              <span className="font-body-sm text-body-sm text-on-surface-variant">Every doctor already has a login. Add doctors in “Doctors & schedule”.</span>
            )}
          </label>
        )}
        {(
          [
            ['Name', name, setName, role === 'doctor' ? 'Dr. Meera Sharma' : 'Sunita (front desk)', 'text'],
            ['Username', username, (v: string) => setUsername(v.toLowerCase().replace(/[^a-z0-9._-]/g, '')), role === 'doctor' ? 'meera' : 'frontdesk', 'text'],
            ['Password (min 8)', password, setPassword, '', 'password'],
          ] as const
        ).map(([label, value, set, ph, type]) => (
          <label key={label} className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
            <input
              type={type}
              value={value}
              placeholder={ph}
              autoComplete="new-password"
              onChange={(e) => set(e.target.value)}
              className="h-11 rounded-lg bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        ))}
        <button
          disabled={!name.trim() || !username || password.length < 8 || (role === 'doctor' && !doctorId)}
          className="h-11 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40"
        >
          Create login
        </button>
        {msg && <p className={`font-body-sm text-body-sm ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
      </form>
    </div>
  );
}

// ---------------- Modules & wallet ----------------

function ModulesTab({ api, tenant, onSaved }: { api: AdminApi; tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const [catalog, setCatalog] = useState<CatalogAddOn[] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [walletMsg, setWalletMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    publicApi.getBillingCatalog().then((c) => setCatalog(c.add_ons));
  }, []);

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
    { key: 'base_plan_active', name: 'Base platform (queue, reception, doctor console)', price: 1199 },
    ...(catalog ?? []).map((a) => ({ key: a.key, name: a.name, price: a.price_inr_per_month })),
  ];

  const otpOn = !!tenant.queue_settings.require_whatsapp_otp;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm lg:col-span-2 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm">WhatsApp OTP at patient check-in</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Off (default) = fastest check-in. On = patients confirm their number with a WhatsApp code first. The clinic&apos;s
            doctor can also change this in Queue Rules.
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
