'use client';

import { useEffect, useState } from 'react';
import { api, type CatalogAddOn, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { inr } from '@/components/staff/bits';

// Screen #10 — Billing / Add-on Marketplace. Ported from
// stitch_medqr_clinic_suite_ui_design/billing_add_on_marketplace/code.html.
// Prices come from GET /billing/catalog (includes the ₹399 Image-to-Text add-on, kept separate
// from ₹499 OCR — Decision 3). Active/inactive comes from tenant.entitlements. Self-serve toggles,
// wallet recharge and invoices need the payment gateway (Decision 9, provider undecided), so they
// are shown as not-yet-available rather than faked.

const DESCRIPTIONS: Record<string, { tag: string; icon: string; body: string }> = {
  prescription_ocr: { tag: 'AI powered', icon: 'document_scanner', body: 'Snap a photo — extracts vitals, medicines & dosage into structured fields.' },
  prescription_image_to_text: { tag: 'AI powered · New', icon: 'text_snippet', body: 'Snap a photo — transcribes handwriting into plain searchable text.' },
  advance_booking: { tag: 'Sync engine', icon: 'sync', body: 'Two-way appointment sync with Google Calendar and booking apps.' },
  smart_print: { tag: 'Hardware', icon: 'print', body: 'Letterhead offset alignment and silent 58/80mm thermal printing.' },
  medication_adherence: { tag: 'Patient care', icon: 'medication', body: 'Automated WhatsApp dose reminders and refill alerts.' },
  custom_forms: { tag: 'Triage flow', icon: 'dynamic_form', body: 'Specialty-specific intake forms with conditional questions.' },
  ai_setup_agent: { tag: 'AI powered', icon: 'smart_toy', body: 'Upload old records or Rx pads to auto-configure schedules.' },
  time_slot_booking: { tag: 'Scheduling', icon: 'event_available', body: 'Time-slot and hybrid booking modes on top of walk-in tokens.' },
};

export default function BillingPage() {
  return <StaffShell variant="doctor" active="/doctor/billing">{({ tenant }) => <Billing tenant={tenant} />}</StaffShell>;
}

function Billing({ tenant }: { tenant: Tenant }) {
  const [catalog, setCatalog] = useState<{ base_plan_price_inr: number; add_ons: CatalogAddOn[] } | null>(null);
  useEffect(() => {
    api.getBillingCatalog().then(setCatalog).catch(() => setCatalog({ base_plan_price_inr: 0, add_ons: [] }));
  }, []);

  if (!catalog) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;

  const isActive = (key: string) => !!tenant.entitlements[key];
  const active = catalog.add_ons.filter((a) => isActive(a.key));
  const monthly = catalog.base_plan_price_inr + active.reduce((sum, a) => sum + a.price_inr_per_month, 0);
  const wallet = Number(tenant.wallet_balance_inr);
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
            Base platform {inr(catalog.base_plan_price_inr)}/mo — queue, reception verifier, doctor console
          </p>
        </div>
        <div className="relative bg-surface-container-low rounded-2xl p-5">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Estimated monthly total</p>
          <p className="font-display-token text-[48px] leading-[52px] font-extrabold text-primary">
            {inr(monthly)}
            <span className="font-body-md text-body-md text-on-surface-variant font-normal"> /mo + GST</span>
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Base {inr(catalog.base_plan_price_inr)} + {active.length} active module{active.length === 1 ? '' : 's'}
          </p>
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
          <button disabled className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg opacity-40 cursor-not-allowed">
            Recharge via UPI
          </button>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Recharge opens once the payment gateway is connected. WhatsApp alerts themselves are also not switched on yet.
          </p>
        </aside>
      </div>
    </div>
  );
}
