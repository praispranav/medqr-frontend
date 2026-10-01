'use client';

import { useEffect, useState } from 'react';
import { api, type CatalogAddOn, type MonthlyPlan, type PaymentQrView, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { inr } from '@/components/staff/bits';
import { UpiQrCard } from '@/components/payments/UpiQrCard';

// Screen #10 — Billing / Add-on Marketplace. Ported from
// stitch_medqr_clinic_suite_ui_design/billing_add_on_marketplace/code.html.
// Prices come from GET /billing/catalog (includes the ₹399 Image-to-Text add-on, kept separate
// from ₹499 OCR — Decision 3). Active/inactive comes from tenant.entitlements. Self-serve module
// toggles and invoices still need the payment gateway (Decision 9); WhatsApp wallet recharge is
// live (same single-use UPI QR gateway as consultation-fee payments, Decisions 9/11).

const DESCRIPTIONS: Record<string, { tag: string; icon: string; body: string }> = {
  prescription_ocr: { tag: 'AI powered', icon: 'document_scanner', body: 'Snap a photo — extracts vitals, medicines & dosage into structured fields.' },
  prescription_image_to_text: { tag: 'AI powered · New', icon: 'text_snippet', body: 'Snap a photo — transcribes handwriting into plain searchable text.' },
  advance_booking: { tag: 'Sync engine', icon: 'sync', body: 'Two-way appointment sync with Google Calendar and booking apps.' },
  smart_print: { tag: 'Hardware', icon: 'print', body: 'Letterhead offset alignment and silent 58/80mm thermal printing.' },
  medication_adherence: { tag: 'Patient care', icon: 'medication', body: 'Automated WhatsApp dose reminders and refill alerts.' },
  ai_setup_agent: { tag: 'AI powered', icon: 'smart_toy', body: 'Upload old records or Rx pads to auto-configure schedules.' },
  time_slot_booking: { tag: 'Scheduling', icon: 'event_available', body: 'Time-slot and hybrid booking modes on top of walk-in tokens.' },
};


export function Billing({ tenant }: { tenant: Tenant }) {
  const [catalog, setCatalog] = useState<{ base_plan_price_inr: number; add_ons: CatalogAddOn[] } | null>(null);
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [wallet, setWallet] = useState(Number(tenant.wallet_balance_inr));
  useEffect(() => {
    api.getBillingCatalog().then(setCatalog).catch(() => setCatalog({ base_plan_price_inr: 0, add_ons: [] }));
    api.billingPlan().then(setPlan).catch(() => setPlan(null));
  }, []);
  useEffect(() => setWallet(Number(tenant.wallet_balance_inr)), [tenant.wallet_balance_inr]);

  if (!catalog) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;

  const isActive = (key: string) => !!tenant.entitlements[key];
  const active = catalog.add_ons.filter((a) => isActive(a.key));
  // Decision 14: base includes one doctor; each extra doctor is +₹499/mo (server computes the lines).
  const monthly = plan?.total_inr_per_month ?? catalog.base_plan_price_inr + active.reduce((sum, a) => sum + a.price_inr_per_month, 0);
  const clinicName = tenant.display_name ?? tenant.subdomain;

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      {/* Plan summary */}
      <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary-fixed/20 pointer-events-none" />
        <div className="relative flex flex-col gap-3">
          <span className="self-start px-2.5 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm uppercase">
            {tenant.entitlements.base_plan_active ? 'Active plan' : 'Plan inactive'}
          </span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Your subscription &amp; modules</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
            Modular OPD tools for {clinicName}. Pay for the base platform, add modules only when you need them.
          </p>
          <p className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
            <Icon name="check_circle" className="text-tertiary text-[18px]" />
            Base platform {inr(catalog.base_plan_price_inr)}/mo — queue, reception verifier, doctor console, custom intake forms, 1 doctor
          </p>
          {plan && (
            <p className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
              <Icon name="group" className="text-primary text-[18px]" />
              {plan.doctor_count} doctor{plan.doctor_count === 1 ? '' : 's'}
              {plan.extra_doctors > 0 ? ` — ${plan.extra_doctors} extra × ${inr(plan.extra_doctor_price_inr)}/mo` : ' — included'}
            </p>
          )}
        </div>
        <div className="relative bg-surface-container-low rounded-2xl p-5">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Estimated monthly total</p>
          <p className="font-display-token text-[48px] leading-[52px] font-extrabold text-primary">
            {inr(monthly)}
            <span className="font-body-md text-body-md text-on-surface-variant font-normal"> /mo + GST</span>
          </p>
          {plan ? (
            <div className="mt-2 flex flex-col gap-1">
              {plan.lines.map((l) => (
                <p key={l.label} className="flex justify-between gap-3 font-body-sm text-body-sm text-on-surface-variant">
                  <span>{l.label}</span>
                  <span className="text-on-surface">{inr(l.amount_inr)}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Base {inr(catalog.base_plan_price_inr)} + {active.length} active module{active.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
        {/* Marketplace */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Module marketplace</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                To switch a module on or off, contact MedQR support — self-serve activation comes with online billing.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-primary-fixed/40 text-on-primary-fixed-variant font-label-md text-label-md whitespace-nowrap">
              {active.length} / {catalog.add_ons.length} enabled
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {catalog.add_ons.map((a) => {
              const d = DESCRIPTIONS[a.key] ?? { tag: 'Module', icon: 'extension', body: '' };
              const on = isActive(a.key);
              return (
                <div key={a.key} className={`rounded-2xl p-4 flex flex-col gap-2 shadow-sm ${on ? 'bg-surface-container-lowest ring-2 ring-primary/30' : 'bg-surface-container-lowest'}`}>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
                      <Icon name={d.icon} className="text-[14px]" /> {d.tag}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${
                        on ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {on ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="font-headline-sm text-headline-sm text-on-surface">{a.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant flex-1">{d.body}</p>
                  <p className="font-headline-sm text-headline-sm text-on-surface">
                    {inr(a.price_inr_per_month)}
                    <span className="font-body-sm text-body-sm text-on-surface-variant"> /mo</span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* WhatsApp wallet */}
        <aside className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4 self-start">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
              <Icon name="chat" className="text-[22px]" />
            </span>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">WhatsApp wallet</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Prepaid token &amp; Rx messages</p>
            </div>
          </div>
          <div className="bg-surface-container-low rounded-xl p-4">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Current balance</p>
            <p className="font-numeric-metric text-numeric-metric text-on-surface">{inr(wallet)}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              ≈ {Math.floor(wallet / 0.2).toLocaleString('en-IN')} messages at ₹0.20 each
            </p>
          </div>
          <RechargeWallet onRecharged={(amount) => setWallet((w) => w + amount)} />
        </aside>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Billed by MedQR, operated by Altis Labs · PAN GRTPK1849H · Udyam Registration No. UDYAM-BR-34-0066884
      </p>
    </div>
  );
}

const PRESET_AMOUNTS = [200, 500, 1000];

/** Self-serve WhatsApp wallet top-up — same single-use UPI QR gateway as consultation-fee payments. */
function RechargeWallet({ onRecharged }: { onRecharged: (amountInr: number) => void }) {
  const [amount, setAmount] = useState(500);
  const [qr, setQr] = useState<PaymentQrView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll while a QR is active — a doctor/clinic-admin's own screen, not the patient's, so there's no
  // token-room socket to piggyback on (unlike the patient payment page).
  useEffect(() => {
    if (!qr || qr.status !== 'active') return;
    const id = setInterval(async () => {
      try {
        const fresh = await api.walletRechargeStatus(qr.id);
        setQr(fresh);
        if (fresh.status === 'paid') {
          onRecharged(fresh.amount_inr);
          setTimeout(() => setQr(null), 2000); // let the "paid" state flash briefly before closing
        }
      } catch {
        /* transient — next tick retries */
      }
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr?.id, qr?.status]);

  const startRecharge = async () => {
    setBusy(true);
    setError(null);
    try {
      setQr(await api.createWalletRechargeQr(amount));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the recharge. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (qr && qr.status === 'paid') {
    return (
      <div className="bg-tertiary-fixed/30 rounded-xl p-4 flex items-center gap-2.5 text-left">
        <Icon name="check_circle" fill className="text-tertiary text-[22px]" />
        <p className="font-label-lg text-label-lg text-on-tertiary-fixed-variant">Recharged {inr(qr.amount_inr)} ✓</p>
      </div>
    );
  }

  if (qr && qr.status === 'active') {
    return (
      <div className="flex flex-col gap-2">
        <UpiQrCard
          qr={qr}
          label={`Recharge ${inr(qr.amount_inr)} by UPI`}
          onSimulate={() => api.simulateWalletRecharge(qr.id)}
          onChanged={async () => setQr(await api.walletRechargeStatus(qr.id))}
        />
        <button onClick={() => setQr(null)} className="font-label-md text-label-md text-on-surface-variant self-center">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {PRESET_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAmount(a)}
            className={`h-10 rounded-lg font-label-md text-label-md ${amount === a ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'}`}
          >
            {inr(a)}
          </button>
        ))}
      </div>
      <div className="flex items-center bg-surface-container-low rounded-xl px-3 h-11">
        <span className="font-label-md text-label-md text-on-surface-variant">₹</span>
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '').slice(0, 6)) || 0)}
          placeholder="Custom amount"
          className="w-full bg-transparent px-1 font-label-lg text-label-lg focus:outline-none"
        />
      </div>
      <button
        disabled={busy || amount < 50 || amount > 50000}
        onClick={startRecharge}
        className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40"
      >
        {busy ? 'Starting…' : `Recharge ${inr(amount)} via UPI`}
      </button>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <p className="font-body-sm text-body-sm text-on-surface-variant">Min ₹50, max ₹50,000 per recharge.</p>
    </div>
  );
}
