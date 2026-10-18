'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/patient/ui';
import type { Tenant } from '@/lib/api';

interface AddOnItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  pricingType: 'paid' | 'usage' | 'beta';
  priceLabel: string;
  badge: string;
  description: string;
  integrationNote: string;
  isActive: boolean;
  actionHref?: string;
  actionLabel: string;
}

interface CoreFeatureItem {
  id: string;
  name: string;
  icon: string;
  tag: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function ProductsHub({
  tenant,
  canManage,
  baseRole,
}: {
  tenant: Tenant;
  canManage: boolean;
  baseRole: 'doctor' | 'manage';
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'included' | 'addons'>('all');
  const [waitlistSuccess, setWaitlistSuccess] = useState<Record<string, boolean>>({});

  const isQrActive = tenant.directory_products
    ? tenant.directory_products.includes('qr-token-system')
    : tenant.qr_enabled !== false;

  const isOcrActive = !!tenant.entitlements?.prescription_ocr;
  const isAdvanceBookingActive = !!tenant.entitlements?.advance_booking;
  const isTimeSlotActive = !!tenant.entitlements?.time_slot_booking;
  const isMedicationActive = !!tenant.entitlements?.medication_adherence;
  const isAiAgentActive = !!tenant.entitlements?.ai_setup_agent;

  const coreFeatures: CoreFeatureItem[] = [
    {
      id: 'qr-standee-tokens',
      name: 'Paperless Standees & Live Patient Queue',
      icon: 'qr_code_2',
      tag: 'Included in Base',
      description: 'Patients scan the clinic QR standee to get a digital token with live turn countdown on their smartphone — zero app download.',
      actionHref: isQrActive ? (baseRole === 'doctor' ? '/doctor/qr-poster' : '/manage/qr') : undefined,
      actionLabel: 'Print Standees',
    },
    {
      id: 'reception-desk',
      name: 'Reception Verifier & Fast Walk-in Entry',
      icon: 'desk',
      tag: 'Included in Base',
      description: 'Front-desk staff can instantly check in arriving patients, search past records by mobile number, and issue manual tokens for walk-ins.',
      actionHref: '/reception',
      actionLabel: 'Open Reception',
    },
    {
      id: 'doctor-console',
      name: 'Doctor Queue Command Center',
      icon: 'stethoscope',
      tag: 'Included in Base',
      description: 'Real-time patient queue on tablet or laptop with instant one-click calling, vitals inspection, prescription writing, and shift status controls.',
      actionHref: '/doctor/dashboard',
      actionLabel: 'Doctor Console',
    },
    {
      id: 'upi-instant-payments',
      name: 'Zero-Fee Direct UPI QR Payments',
      icon: 'currency_rupee',
      tag: '0% Gateway Fee',
      description: 'Generates dynamic UPI QR codes per patient token. Patients scan with GPay, PhonePe, or Paytm; funds settle directly to clinic/doctor bank.',
      actionHref: baseRole === 'doctor' ? '/doctor/online-payments' : '/manage/online-payments',
      actionLabel: 'Configure UPI',
    },
    {
      id: 'smart-thermal-printer',
      name: 'Smart Letterhead & Thermal Printer Driver',
      icon: 'print',
      tag: 'Hardware Ready',
      description: 'Print 58mm/80mm paper token slips instantly at reception, or print digital prescriptions with precise letterhead top and bottom margin alignment.',
      actionHref: isQrActive ? (baseRole === 'doctor' ? '/doctor/qr-poster' : '/manage/qr') : undefined,
      actionLabel: 'Printer Settings',
    },
    {
      id: 'custom-intake-builder',
      name: 'Custom Patient Intake Form Builder',
      icon: 'assignment',
      tag: 'Fully Customizable',
      description: 'Collect tailored clinical history, symptoms, pediatric info, or vitals from patients on their phones while waiting in the OPD queue.',
      actionHref: '/doctor/intake-form',
      actionLabel: 'Intake Forms',
    },
  ];

  const addOns: AddOnItem[] = [
    {
      id: 'ai-prescription-ocr',
      name: 'Prescription & Lab Reports AI (OCR & Handwriting)',
      category: 'Clinical AI',
      icon: 'document_scanner',
      pricingType: 'paid',
      priceLabel: '₹399 / month',
      badge: isOcrActive ? 'Active Add-on' : 'AI Powered Add-on',
      description: 'Snap photos of handwritten doctor prescriptions, paper OPD slips, or diagnostic reports to extract vitals, medicines, dosages, and complaints automatically into structured clinical fields.',
      integrationNote: 'Injects extracted clinical data directly into Doctor Consultation Cabin during live OPD queue.',
      isActive: isOcrActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isOcrActive ? 'Manage Add-on' : 'Request Add-on',
    },
    {
      id: 'whatsapp-patient-care',
      name: 'WhatsApp Automation & Dose Reminders',
      category: 'Patient Communication',
      icon: 'chat',
      pricingType: 'usage',
      priceLabel: '₹0.20 per message (from wallet)',
      badge: 'Official Meta Cloud API',
      description: 'Automated WhatsApp alerts to patients when doctor arrives, live turn notifications, digital token slips, and automated medication dosage reminders.',
      integrationNote: 'Connected directly to clinic WhatsApp sender wallet with live delivery receipts.',
      isActive: true,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: 'WhatsApp Wallet',
    },
    {
      id: 'advance-calendar-booking',
      name: 'Multi-Day Online Booking & Google Calendar Sync',
      category: 'Scheduling Engine',
      icon: 'event_available',
      pricingType: 'paid',
      priceLabel: '₹299 / month',
      badge: isAdvanceBookingActive ? 'Active Add-on' : 'Sync Engine',
      description: 'Offer scheduled consultation slots on future dates from your public web page with two-way synchronization into doctor personal Google Calendar.',
      integrationNote: 'Synchronizes with Doctor Planned Timings and Public Directory Listing.',
      isActive: isAdvanceBookingActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isAdvanceBookingActive ? 'Manage Add-on' : 'Request Add-on',
    },
    {
      id: 'time-slot-booking',
      name: 'Time-Slot / Hybrid Booking Engine',
      category: 'Scheduling Engine',
      icon: 'calendar_month',
      pricingType: 'paid',
      priceLabel: '₹299 / month',
      badge: isTimeSlotActive ? 'Active Add-on' : 'Hybrid Queue',
      description: 'Seamlessly blend fixed-appointment time slots with live walk-in OPD queue tokens so scheduled patients get priority without disrupting queue flow.',
      integrationNote: 'Integrates into reception check-in and queue token issuance engine.',
      isActive: isTimeSlotActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isTimeSlotActive ? 'Manage Add-on' : 'Request Add-on',
    },
    {
      id: 'medication-adherence',
      name: 'Medication Adherence Engine',
      category: 'Patient Care',
      icon: 'medication',
      pricingType: 'paid',
      priceLabel: '₹299 / month',
      badge: isMedicationActive ? 'Active Add-on' : 'Patient Adherence',
      description: 'Sends automated WhatsApp medicine schedule reminders and timely refill reminders to chronic and follow-up patients after consultation.',
      integrationNote: 'Triggers automatically when digital prescriptions are finalized by doctor.',
      isActive: isMedicationActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isMedicationActive ? 'Manage Add-on' : 'Request Add-on',
    },
    {
      id: 'ai-clinic-setup-agent',
      name: 'AI Clinic Setup Agent',
      category: 'Clinical AI',
      icon: 'smart_toy',
      pricingType: 'paid',
      priceLabel: '₹199 / month',
      badge: isAiAgentActive ? 'Active Add-on' : 'AI Assistant',
      description: 'Upload photos of old Rx pads or doctor duty rosters to auto-configure doctor schedules, session timings, and consultation fee rules.',
      integrationNote: 'Directly configures Doctor Timings and Reception Verification parameters.',
      isActive: isAiAgentActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isAiAgentActive ? 'Manage Add-on' : 'Request Add-on',
    },
    {
      id: 'voice-clinical-scribe',
      name: 'AI Voice Consultation Scribe (Multilingual)',
      category: 'Clinical AI',
      icon: 'mic',
      pricingType: 'beta',
      priceLabel: 'Early Access · Free Beta',
      badge: 'Hindi + English Speech',
      description: 'Speak naturally during patient consultations. AI transcribes doctor-patient dialogue, formats chief complaints, diagnosis, and Rx instructions into structured notes.',
      integrationNote: 'Designed to integrate directly into ClinicQ consultation cabin workflow.',
      isActive: false,
      actionLabel: 'Join Early Access',
    },
  ];

  const handleWaitlist = (id: string) => {
    setWaitlistSuccess((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      {/* Product Hero: The Single Unified Product */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border border-surface-container relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/5 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative">
          <div className="flex-1 max-w-3xl flex flex-col gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-bold tracking-wider uppercase">
                QUEUE MANAGEMENT
              </span>
              <span
                className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                  isQrActive
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {isQrActive ? 'Active in Clinic' : 'Base Subscription'}
              </span>
            </div>

            <h1 className="font-headline-lg md:text-[32px] md:leading-[38px] font-extrabold text-on-surface">
              QR Token &amp; OPD Queue System
            </h1>

            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
              Paperless token standees for clinic entrance, real-time live token tracking on patient WhatsApp, and instant reception check-in verification. Base plan includes up to 3 doctors.
            </p>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-2 text-on-surface-variant font-label-md text-label-md">
              <span className="flex items-center gap-1.5 text-on-surface">
                <Icon name="check_circle" className="text-tertiary text-[18px]" />
                Includes up to 3 doctors
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="add_circle_outline" className="text-primary text-[18px]" />
                ₹499/mo per additional doctor past 3
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="speed" className="text-primary text-[18px]" />
                Unlimited patient tokens
              </span>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 lg:w-[320px] shrink-0 flex flex-col justify-between gap-5 border border-surface-container">
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Subscription Charge
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="font-display-token text-[38px] leading-[42px] font-black text-primary">
                  ₹1,199
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant font-normal">
                  / month + GST
                </span>
              </div>
              <p className="font-body-xs text-body-xs text-on-surface-variant mt-1.5">
                Full core system with web app, reception console, and doctor workspace.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {isQrActive ? (
                <Link
                  href={baseRole === 'doctor' ? '/doctor/qr-poster' : '/manage/qr'}
                  className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
                >
                  <Icon name="qr_code_2" className="text-[18px]" />
                  Standee &amp; QR Settings
                </Link>
              ) : (
                <Link
                  href={baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing'}
                  className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
                >
                  <Icon name="confirmation_number" className="text-[18px]" />
                  Activate Base Plan
                </Link>
              )}
              <Link
                href={baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing'}
                className="w-full h-10 rounded-xl bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors"
              >
                <Icon name="account_balance_wallet" className="text-[16px]" />
                Manage Plan &amp; Add-ons
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs within this Product: Details, Included Tools, Add-ons */}
      <div className="flex items-center justify-between border-b border-surface-container pb-2 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {[
            { key: 'all', label: 'All Details & Add-ons' },
            { key: 'included', label: `Built-in Tools (${coreFeatures.length})` },
            { key: 'addons', label: `Integrated Add-ons (${addOns.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`h-9 px-4 rounded-xl font-label-md text-label-md transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-on-primary shadow-sm font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Link
          href={baseRole === 'doctor' ? '/doctor/hours' : '/manage/team'}
          className="inline-flex items-center gap-1.5 text-primary font-label-sm text-label-sm hover:underline"
        >
          <Icon name="schedule" className="text-[16px]" />
          Set Doctor Timings
        </Link>
      </div>

      {/* SECTION 1: Included Features & Built-in Tools */}
      {(activeTab === 'all' || activeTab === 'included') && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
                <Icon name="inventory_2" className="text-primary text-[22px]" />
                Included with QR Token &amp; OPD Queue System
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Core clinical capabilities and built-in tools ready to use without extra subscriptions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreFeatures.map((f) => (
              <div
                key={f.id}
                className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-container flex flex-col justify-between gap-3.5 hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon name={f.icon} className="text-[22px]" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-label-xs text-label-xs font-bold">
                      {f.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-label-lg text-label-lg font-bold text-on-surface">
                      {f.name}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>

                {f.actionHref && (
                  <div className="pt-2 border-t border-surface-container">
                    <Link
                      href={f.actionHref}
                      className="inline-flex items-center gap-1 text-primary font-label-sm text-label-sm font-semibold hover:underline"
                    >
                      {f.actionLabel}
                      <Icon name="arrow_forward" className="text-[14px]" />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2: Integrated Add-ons & Modular Extensions */}
      {(activeTab === 'all' || activeTab === 'addons') && (
        <section className="flex flex-col gap-4 mt-2">
          <div>
            <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
              <Icon name="extension" className="text-primary text-[22px]" />
              Modular Add-ons &amp; Extensions
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Plug-and-play extensions that operate directly inside your QR Token &amp; OPD Queue System.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {addOns.map((a) => {
              const isDone = waitlistSuccess[a.id];
              return (
                <div
                  key={a.id}
                  className={`bg-surface-container-lowest rounded-2xl p-5 shadow-sm border flex flex-col justify-between gap-4 transition-all ${
                    a.isActive
                      ? 'border-primary/40 ring-1 ring-primary/20'
                      : 'border-surface-container hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-11 h-11 rounded-xl bg-primary-fixed/40 text-primary flex items-center justify-center shrink-0">
                        <Icon name={a.icon} className="text-[24px]" />
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-label-xs text-label-xs font-semibold shrink-0 ${
                          a.isActive
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {a.badge}
                      </span>
                    </div>

                    <div>
                      <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider block">
                        {a.category}
                      </span>
                      <h3 className="font-label-lg text-label-lg text-on-surface font-bold mt-0.5">
                        {a.name}
                      </h3>
                    </div>

                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      {a.description}
                    </p>

                    <div className="bg-surface-container-low rounded-xl p-2.5 flex items-start gap-1.5 text-on-surface-variant font-body-xs text-body-xs">
                      <Icon name="link" className="text-primary text-[15px] shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-on-surface">Queue integration:</strong> {a.integrationNote}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-surface-container flex flex-col gap-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">Add-on Price</span>
                      <span className="font-label-md text-label-md font-bold text-primary">
                        {a.priceLabel}
                      </span>
                    </div>

                    {a.pricingType === 'beta' ? (
                      <button
                        type="button"
                        disabled={isDone}
                        onClick={() => handleWaitlist(a.id)}
                        className="w-full h-10 rounded-xl bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container active:scale-[0.99] transition-all disabled:opacity-75"
                      >
                        <Icon name={isDone ? 'check' : 'notifications'} className="text-[16px]" />
                        {isDone ? 'Interest Recorded' : a.actionLabel}
                      </button>
                    ) : a.actionHref ? (
                      <Link
                        href={a.actionHref}
                        className={`w-full h-10 rounded-xl font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          a.isActive
                            ? 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                            : 'bg-primary text-on-primary shadow-sm hover:opacity-95'
                        }`}
                      >
                        <Icon name={a.isActive ? 'settings' : 'arrow_forward'} className="text-[16px]" />
                        {a.actionLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Integration Notice */}
      <div className="bg-surface-container-low rounded-2xl p-5 flex items-start gap-3.5 border border-surface-container">
        <Icon name="hub" className="text-primary text-[24px] shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-label-lg text-label-lg font-bold text-on-surface">
            Need custom clinic tools or HMS integrations?
          </h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            ClinicQ supports custom EHR data connectors, pharmacy dispatch integrations, and hospital management system (HMS) API bridges that connect into your QR Token System.
          </p>
        </div>
        <Link
          href={baseRole === 'doctor' ? '/doctor/support' : '/manage/support'}
          className="h-9 px-3 rounded-xl bg-surface-container-highest text-primary font-label-sm text-label-sm flex items-center justify-center shrink-0 hover:bg-surface-container"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
