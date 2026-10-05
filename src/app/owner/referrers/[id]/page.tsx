'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Icon } from '@/components/patient/ui';
import { inr } from '@/components/staff/bits';
import { BankForm, Ledger, LoginShareCard, MoneySummary, RatesFields, scheduleText } from '@/components/referrals/ReferralParts';
import type { AdminApi, AdminTenant, PayoutMethod, ReferrerDetail, ReferrerRates } from '@/lib/adminApi';

// Decision 27 — one referral partner: login, reward amounts, payout schedule, their clinics (with
// per-clinic amounts), bank / UPI details, and the ledger with a manual "Mark paid".

export default function ReferrerPage() {
  return <AdminShell active="/owner/referrers">{(api) => <ReferrerView api={api} />}</AdminShell>;
}

const SUB_LABEL = { trial: 'Free trial', active: 'Paying', grace: 'Payment overdue', read_only: 'Read-only' } as const;

function ReferrerView({ api }: { api: AdminApi }) {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<ReferrerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState<string | null>(null); // password after a reset — shown once

  useEffect(() => {
    api.referrer(id).then(setR).catch((e: Error) => setError(e.message));
  }, [api, id]);

  if (error && !r) return <p className="font-body-md text-body-md text-error">{error}</p>;
  if (!r) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;

  const act = async (fn: () => Promise<ReferrerDetail>) => {
    setError(null);
    try {
      setR(await fn());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Link href="/owner/referrers" className="flex items-center gap-1.5 text-primary font-label-md text-label-md self-start">
        <Icon name="arrow_back" className="text-[18px]" /> All referrers
      </Link>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-headline-lg text-headline-lg">{r.name}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {r.email}
            {r.mobile_number ? ` · +91 ${r.mobile_number}` : ''} ·{' '}
            {r.last_login_at ? `last login ${new Date(r.last_login_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'never logged in'}
          </p>
        </div>
        <button
          onClick={async () => {
            if (!window.confirm(`Make a new password for ${r.name}? The old one stops working now.`)) return;
            try {
              setLogin((await api.resetReferrerPassword(r.id)).password);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
          className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md"
        >
          Reset password
        </button>
        <button
          onClick={() => act(() => api.updateReferrer(r.id, { is_active: !r.is_active }))}
          className="h-10 px-4 rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md"
        >
          {r.is_active ? 'Turn login off' : 'Turn login on'}
        </button>
      </section>

      {login && <LoginShareCard name={r.name} email={r.email} mobile={r.mobile_number} password={login} onClose={() => setLogin(null)} />}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

      <MoneySummary r={r} />
      <MarkPaid r={r} onPay={(body) => act(() => api.recordReferrerPayout(r.id, body))} />
      <Rates r={r} onSave={(body) => act(() => api.updateReferrer(r.id, body))} />
      <Clinics api={api} r={r} act={act} />
      <BankForm key={r.bank.updated_at ?? 'none'} bank={r.bank} onSave={async (b) => setR(await api.updateReferrer(r.id, b))} />
      <Ledger
        r={r}
        onVoid={(earningId) => {
          const reason = window.prompt('Cancel this reward? Reason (shown to the referrer):', 'Clinic left / refunded');
          if (reason !== null) act(() => api.voidReferralEarning(earningId, reason));
        }}
      />
    </div>
  );
}

/** Manual payout: you paid them outside MedQR (bank / UPI / cash) — record it here. */
function MarkPaid({ r, onPay }: { r: ReferrerDetail; onPay: (b: { amount_inr: number; method: PayoutMethod; reference?: string }) => Promise<void> }) {
  const [amount, setAmount] = useState(String(Math.max(r.balance_inr, 0) || ''));
  const [method, setMethod] = useState<PayoutMethod>(r.bank.upi_id ? 'upi' : r.bank.account_number ? 'bank' : 'cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setAmount(String(Math.max(r.balance_inr, 0) || '')), [r.balance_inr]);

  const payTo =
    method === 'upi'
      ? r.bank.upi_id ?? 'no UPI ID saved'
      : method === 'bank'
        ? r.bank.account_number
          ? `${r.bank.account_holder ?? ''} · A/c ${r.bank.account_number} · ${r.bank.ifsc ?? ''}`
          : 'no bank account saved'
        : 'hand over cash';

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div>
        <h2 className="font-headline-sm text-headline-sm">Mark paid</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {scheduleText(r)}. Pay them yourself, then record it here. Pay to: <strong className="text-on-surface">{payTo}</strong>
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Amount paid</span>
          <div className="flex items-center h-12 rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary/30">
            <span className="text-on-surface-variant mr-1">₹</span>
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className="flex-1 bg-transparent font-body-lg text-body-lg focus:outline-none min-w-0" />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">How</span>
          <select value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)} className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg">
            <option value="bank">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Reference (optional)</span>
          <input
            value={reference}
            placeholder={method === 'cash' ? 'Paid at office' : 'UTR / UPI ref'}
            onChange={(e) => setReference(e.target.value)}
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>
      <button
        disabled={busy || !Number(amount)}
        onClick={async () => {
          if (!window.confirm(`Record ${inr(Number(amount))} paid to ${r.name} by ${method === 'bank' ? 'bank transfer' : method === 'upi' ? 'UPI' : 'cash'}?`)) return;
          setBusy(true);
          await onPay({ amount_inr: Number(amount), method, reference: reference.trim() || undefined });
          setReference('');
          setBusy(false);
        }}
        className="h-12 self-start px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60 flex items-center gap-2"
      >
        <Icon name="check_circle" className="text-[20px]" /> {busy ? 'Saving…' : 'Mark paid'}
      </button>
    </section>
  );
}

function Rates({ r, onSave }: { r: ReferrerDetail; onSave: (b: Partial<ReferrerRates> & { notes?: string | null }) => Promise<void> }) {
  const [rates, setRates] = useState<ReferrerRates>({ one_time_inr: r.one_time_inr, monthly_inr: r.monthly_inr, payout_frequency: r.payout_frequency, payout_day: r.payout_day });
  const [notes, setNotes] = useState(r.notes ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div>
        <h2 className="font-headline-sm text-headline-sm">Rewards</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Counted only while a clinic is on a paid MedQR plan — never during the free trial. Changes apply to rewards from now on.
        </p>
      </div>
      <RatesFields value={rates} onChange={setRates} />
      <label className="flex flex-col gap-1">
        <span className="font-label-md text-label-md">Private notes (not shown to them)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl bg-surface-container-low p-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </label>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onSave({ ...rates, notes: notes.trim() || null });
          setBusy(false);
        }}
        className="h-12 self-start px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save rewards'}
      </button>
    </section>
  );
}

function Clinics({ api, r, act }: { api: AdminApi; r: ReferrerDetail; act: (fn: () => Promise<ReferrerDetail>) => Promise<void> }) {
  const [all, setAll] = useState<AdminTenant[]>([]);
  const [pick, setPick] = useState('');
  useEffect(() => {
    api.tenants().then(setAll).catch(() => undefined);
  }, [api]);
  const mine = new Set(r.clinics.map((c) => c.id));
  const others = all.filter((t) => !mine.has(t.id));

  const amountInput = (clinicId: string, key: 'one_time_inr' | 'monthly_inr', current: number | null, fallback: number) => (
    <input
      key={`${clinicId}-${key}-${current}`}
      inputMode="numeric"
      defaultValue={current ?? ''}
      placeholder={String(fallback)}
      title="Leave empty to use the referrer’s amount"
      onBlur={(e) => {
        const v = e.target.value.replace(/\D/g, '');
        const next = v === '' ? null : Number(v);
        if (next !== current) act(() => api.setReferrerClinicRates(r.id, clinicId, { [key]: next }));
      }}
      className="w-24 h-10 rounded-lg bg-surface-container-low px-2 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );

  return (
    <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-headline-sm text-headline-sm">Clinics ({r.clinics.length})</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Clinics they create are added here automatically. Amounts: leave empty to use their usual ₹.</p>
      </div>
      {r.clinics.map((c) => (
        <div key={c.id} className="px-5 py-3 border-t border-surface-container flex flex-wrap items-center gap-3">
          <Link href={`/owner/clinics/${c.id}`} className="flex-1 min-w-[180px]">
            <p className="font-label-lg text-label-lg text-primary">{c.name}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {c.subdomain} · {SUB_LABEL[c.subscription]}
            </p>
          </Link>
          <label className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
            once ₹{amountInput(c.id, 'one_time_inr', c.one_time_inr, r.one_time_inr)}
          </label>
          <label className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
            monthly ₹{amountInput(c.id, 'monthly_inr', c.monthly_inr, r.monthly_inr)}
          </label>
          <button
            onClick={() => window.confirm(`Take ${c.name} away from ${r.name}? Rewards already earned stay.`) && act(() => api.unassignReferrerClinic(r.id, c.id))}
            className="h-10 px-3 rounded-lg font-label-md text-label-md text-on-surface-variant hover:text-error"
          >
            Unassign
          </button>
        </div>
      ))}
      <div className="px-5 py-4 border-t border-surface-container flex flex-wrap items-center gap-2 bg-surface-container-low/50">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-11 flex-1 min-w-[200px] rounded-xl bg-surface-container-lowest px-3 font-body-md text-body-md">
          <option value="">Assign an existing clinic…</option>
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.display_name ?? t.subdomain}
              {t.referrer_id ? ' (has another referrer)' : ''}
            </option>
          ))}
        </select>
        <button
          disabled={!pick}
          onClick={async () => {
            await act(() => api.assignReferrerClinic(r.id, pick));
            setPick('');
          }}
          className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-50"
        >
          Assign
        </button>
      </div>
    </section>
  );
}
