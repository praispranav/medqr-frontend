'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api as publicApi, type CatalogAddOn, type Tenant } from '@/lib/api';
import type { AdminApi, SubscriptionStatusView } from '@/lib/adminApi';
import { DoctorsTab, LoginsTab, type TeamApi } from '@/components/team/TeamManager';
import { Icon } from '@/components/patient/ui';
import { AdminShell } from '@/components/admin/AdminShell';
import { inr } from '@/components/staff/bits';

// One clinic: doctors, their day-by-day consulting sessions (these drive the today-only
// availability chips, Decision 6), module switches (Decision 3 keeps OCR and Image-to-Text
// separate), and manual WhatsApp-wallet credit until the payment gateway exists.

export default function AdminClinicPage() {
  return <AdminShell active="/owner/clinics">{(api) => <ClinicDetail api={api} />}</AdminShell>;
}


function ClinicDetail({ api }: { api: AdminApi }) {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<'doctors' | 'logins' | 'modules'>('doctors');
  const [error, setError] = useState<string | null>(null);
  const team = useMemo(() => adminTeamApi(api, id), [api, id]);

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
        <div className="flex flex-wrap gap-2">
          <Link href={`/patient/${tenant.subdomain}`} target="_blank" className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-2">
            <Icon name="smartphone" className="text-[18px]" /> Patient check-in page
          </Link>
          <Link href={`/login?clinic=${tenant.subdomain}`} target="_blank" className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-2">
            <Icon name="login" className="text-[18px]" /> Doctor/Staff Login page
          </Link>
        </div>
      </section>

      <SubscriptionCard api={api} tenantId={tenant.id} />

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

      {tab === 'doctors' && <DoctorsTab api={team} />}
      {tab === 'logins' && <LoginsTab api={team} clinicCode={tenant.subdomain} />}
      {tab === 'modules' && <ModulesTab api={api} tenant={tenant} onSaved={setTenant} />}
    </div>
  );
}

function adminTeamApi(api: AdminApi, tenantId: string): TeamApi {
  return {
    doctors: () => api.doctors(tenantId),
    createDoctor: (b) => api.createDoctor(tenantId, b),
    updateDoctor: (id, b) => api.updateDoctor(id, b),
    deleteDoctor: (id) => api.deleteDoctor(id),
    schedule: (doctorId) => ({
      list: (date) => api.sessions(doctorId, date),
      add: (body) => api.addSession(doctorId, body),
      repeat: (from, days) => api.repeatSchedule(doctorId, from, days),
      setActive: (id, active) => api.setSessionActive(id, active),
      remove: (id) => api.deleteSession(id),
    }),
    users: () => api.users(tenantId),
    createUser: (b) => api.createUser(tenantId, b),
    updateUser: (id, b) => api.updateUser(id, b),
    resetPassword: (id) => api.resetPassword(id),
    deleteUser: (id) => api.deleteUser(id),
    canGrantOwner: true,
    directoryFields: true,
  };
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

// ---------------- Platform-fee trial / subscription (Decision 18) ----------------

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

const STATUS_LABEL: Record<SubscriptionStatusView['status'], { text: string; className: string }> = {
  trial: { text: 'Free trial', className: 'bg-tertiary-container text-on-tertiary-container' },
  active: { text: 'Active', className: 'bg-primary-container text-on-primary-container' },
  grace: { text: 'Grace period', className: 'bg-secondary-container text-on-secondary-container' },
  read_only: { text: 'Read-only (unpaid)', className: 'bg-error-container text-on-error-container' },
};

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
          {sub.status === 'grace' ? 'Grace period ends' : 'Trial ends'} {new Date(windowEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          {left !== null && ` (${left >= 0 ? `${left} day${left === 1 ? '' : 's'} left` : 'expired'})`}
        </p>
      )}
      {sub.status === 'read_only' && (
        <p className="font-body-md text-body-md text-error">Staff can view but not change anything for this clinic until it's marked active.</p>
      )}

      <div className="flex flex-wrap items-end gap-2 pt-1">
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Extend trial by (days)</label>
          <input
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
            className="w-24 h-10 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          disabled={busy || !Number(days)}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setSub(await api.extendTrial(tenantId, Number(days)));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md disabled:opacity-60"
        >
          Extend trial
        </button>
        <button
          disabled={busy || sub.status === 'active'}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setSub(await api.setSubscriptionActive(tenantId));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60"
        >
          Mark active (paid offline)
        </button>
      </div>
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
