'use client';

import { useEffect, useState } from 'react';
import type { PayoutStatusName, PayoutView } from '@/lib/api';
import type { AdminApi, AdminDoctor, PayoutKyc } from '@/lib/adminApi';
import { Icon } from '@/components/patient/ui';

// Decision 44 — link each doctor's own bank account (Razorpay Route linked account, category healthcare) so patients'
// online fees are transferred straight to them. Super admin only. PAN / bank details are forwarded to Razorpay and
// never stored by ClinicQ.

const STATUS: Record<PayoutStatusName, { label: string; tone: string }> = {
  none: { label: 'Not linked', tone: 'bg-surface-container text-on-surface-variant' },
  created: { label: 'KYC started', tone: 'bg-secondary-fixed text-on-secondary-fixed' },
  needs_clarification: { label: 'Razorpay needs more details', tone: 'bg-error-container text-on-error-container' },
  under_review: { label: 'Under review', tone: 'bg-secondary-fixed text-on-secondary-fixed' },
  activated: { label: 'Active', tone: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  suspended: { label: 'Suspended', tone: 'bg-error-container text-on-error-container' },
  rejected: { label: 'Rejected', tone: 'bg-error-container text-on-error-container' },
};

const EMPTY: PayoutKyc = {
  legal_name: '',
  pan: '',
  email: '',
  phone: '',
  gst: '',
  address: { street1: '', street2: '', city: '', state: '', postal_code: '' },
  bank: { account_number: '', ifsc: '', beneficiary_name: '' },
};

const field = 'h-11 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30 w-full';

export function PayoutsTab({ api, tenantId }: { api: AdminApi; tenantId: string }) {
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.doctors(tenantId).then(setDoctors).catch((e: Error) => setError(e.message));
  }, [api, tenantId]);

  if (error) return <p className="font-body-md text-body-md text-error">{error}</p>;
  if (!doctors) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Online fees are collected by Razorpay and transferred in full to each doctor&apos;s own bank account after Razorpay verifies their KYC
        (business category: Healthcare). ClinicQ does not keep PAN or bank details — they go straight to Razorpay.
      </p>
      {doctors.map((d) => (
        <DoctorPayout key={d.id} api={api} doctor={d} />
      ))}
      {doctors.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">Add a doctor first.</p>}
    </div>
  );
}

function DoctorPayout({ api, doctor }: { api: AdminApi; doctor: AdminDoctor }) {
  const [view, setView] = useState<PayoutView | null>(null);
  const [mode, setMode] = useState<'kyc' | 'link'>('kyc');
  const [kyc, setKyc] = useState<PayoutKyc>({ ...EMPTY, legal_name: doctor.name.replace(/^Dr\.?\s*/i, '') });
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.payoutAccount(doctor.id).then(setView).catch((e: Error) => setMsg({ kind: 'error', text: e.message }));
  }, [api, doctor.id]);

  const run = async (fn: () => Promise<PayoutView | { retried: number }>, done: (r: never) => string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if ('status' in r) setView(r);
      setMsg({ kind: 'ok', text: done(r as never) });
      setKyc((k) => ({ ...EMPTY, legal_name: k.legal_name })); // don't keep PAN / bank numbers on screen
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<PayoutKyc>) => setKyc((k) => ({ ...k, ...patch }));
  const setAddr = (patch: Partial<PayoutKyc['address']>) => setKyc((k) => ({ ...k, address: { ...k.address, ...patch } }));
  const setBank = (patch: Partial<PayoutKyc['bank']>) => setKyc((k) => ({ ...k, bank: { ...k.bank, ...patch } }));

  const st = STATUS[view?.status ?? 'none'];

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Icon name="account_balance" className="text-primary text-[22px]" />
        <p className="font-headline-sm text-headline-sm flex-1 min-w-0 truncate">{doctor.name}</p>
        <span className={`px-3 py-1 rounded-full font-label-md text-label-md ${st.tone}`}>{st.label}</span>
      </div>

      {view && !view.required && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Route is not enforced yet (RAZORPAY_ROUTE_REQUIRED is off on the server): until it is, patients can still pay online without this
          doctor being linked, and those fees stay in the ClinicQ Razorpay account.
        </p>
      )}
      {view?.mock && <p className="font-body-sm text-body-sm text-secondary">Razorpay keys are not set — this is the dev mock, nothing is sent to Razorpay.</p>}

      {view?.linked ? (
        <div className="flex flex-col gap-2">
          <p className="font-body-md text-body-md">
            Account <span className="font-mono">{view.account_id}</span>
            {view.legal_name ? ` · ${view.legal_name}` : ''}
            {view.bank_last4 ? ` · bank ••••${view.bank_last4}` : ''}
          </p>
          {view.requirements.length > 0 && (
            <p className="font-body-sm text-body-sm text-error">Razorpay still needs: {view.requirements.join(', ')}. Fix it in the Razorpay dashboard (Route → Linked accounts), then Refresh.</p>
          )}
          <div className="flex gap-2 flex-wrap">
            <button disabled={busy} onClick={() => run(() => api.refreshPayoutAccount(doctor.id), () => 'Status refreshed')} className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md disabled:opacity-60">
              Refresh status
            </button>
            {view.status === 'activated' && (
              <button
                disabled={busy}
                onClick={() => run(() => api.retryPayoutTransfers(doctor.id), (r: { retried: number }) => `${r.retried} pending transfer${r.retried === 1 ? '' : 's'} sent`)}
                className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md disabled:opacity-60"
              >
                Send pending fees
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Stop routing ${doctor.name}'s fees to this account? The account stays in Razorpay.`)) {
                  run(() => api.unlinkPayoutAccount(doctor.id), () => 'Unlinked');
                }
              }}
              className="h-10 px-4 rounded-xl text-error font-label-md text-label-md disabled:opacity-60"
            >
              Unlink
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {(
              [
                ['kyc', 'Enter KYC details'],
                ['link', 'I already have an acc_ id'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} onClick={() => setMode(k)} className={`px-3 py-1.5 rounded-full font-label-md text-label-md ${mode === k ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'link' ? (
            <form
              className="flex gap-2 flex-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api.linkPayoutAccount(doctor.id, accountId), () => 'Linked');
              }}
            >
              <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="acc_XXXXXXXXXXXXXX" className={`${field} flex-1 min-w-[220px]`} />
              <button disabled={busy || !accountId.trim()} className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">
                Link account
              </button>
            </form>
          ) : (
            <form
              autoComplete="off"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api.createPayoutAccount(doctor.id, kyc), () => 'Sent to Razorpay — check the status in a minute');
              }}
            >
              <Labeled label="Full name (as on PAN)"><input value={kyc.legal_name} onChange={(e) => set({ legal_name: e.target.value })} className={field} /></Labeled>
              <Labeled label="PAN"><input value={kyc.pan} onChange={(e) => set({ pan: e.target.value.toUpperCase() })} maxLength={10} placeholder="ABCDE1234F" className={field} /></Labeled>
              <Labeled label="Email"><input type="email" value={kyc.email} onChange={(e) => set({ email: e.target.value })} className={field} /></Labeled>
              <Labeled label="Mobile"><input inputMode="numeric" value={kyc.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={field} /></Labeled>
              <Labeled label="Address line 1"><input value={kyc.address.street1} onChange={(e) => setAddr({ street1: e.target.value })} className={field} /></Labeled>
              <Labeled label="Address line 2 (optional)"><input value={kyc.address.street2} onChange={(e) => setAddr({ street2: e.target.value })} className={field} /></Labeled>
              <Labeled label="City"><input value={kyc.address.city} onChange={(e) => setAddr({ city: e.target.value })} className={field} /></Labeled>
              <Labeled label="State"><input value={kyc.address.state} onChange={(e) => setAddr({ state: e.target.value })} placeholder="e.g. Karnataka" className={field} /></Labeled>
              <Labeled label="PIN code"><input inputMode="numeric" value={kyc.address.postal_code} onChange={(e) => setAddr({ postal_code: e.target.value.replace(/\D/g, '').slice(0, 6) })} className={field} /></Labeled>
              <Labeled label="GSTIN (only if registered)"><input value={kyc.gst} onChange={(e) => set({ gst: e.target.value.toUpperCase() })} className={field} /></Labeled>
              <Labeled label="Bank account number"><input inputMode="numeric" value={kyc.bank.account_number} onChange={(e) => setBank({ account_number: e.target.value.replace(/\D/g, '') })} className={field} /></Labeled>
              <Labeled label="IFSC"><input value={kyc.bank.ifsc} onChange={(e) => setBank({ ifsc: e.target.value.toUpperCase() })} maxLength={11} placeholder="HDFC0001234" className={field} /></Labeled>
              <Labeled label="Name on bank account (if different)"><input value={kyc.bank.beneficiary_name} onChange={(e) => setBank({ beneficiary_name: e.target.value })} className={field} /></Labeled>
              <div className="sm:col-span-2 flex justify-end">
                <button disabled={busy} className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">
                  {busy ? 'Sending…' : 'Create account at Razorpay'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {msg && <p className={`font-body-sm text-body-sm ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
