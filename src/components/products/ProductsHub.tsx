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
  priceLabel: string;
  badge: string;
  description: string;
  integrationNote: string;
  isActive: boolean;
  actionHref?: string;
  actionLabel: string;
  isBeta?: boolean;
}

interface SystemProduct {
  id: string;
  category: string;
  name: string;
  priceLabel: string;
  billingFrequency: string;
  status: 'active' | 'available' | 'coming_soon';
  badge: string;
  tagline: string;
  description: string;
  highlights: string[];
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'kit' | 'addons' | 'terms'>('kit');
  const [waitlistSuccess, setWaitlistSuccess] = useState<Record<string, boolean>>({});

  const isQrActive = tenant.directory_products
    ? tenant.directory_products.includes('qr-token-system')
    : tenant.qr_enabled !== false;

  const isOcrActive = !!tenant.entitlements?.prescription_ocr;
  const isAdvanceBookingActive = !!tenant.entitlements?.advance_booking;
  const isTimeSlotActive = !!tenant.entitlements?.time_slot_booking;
  const isMedicationActive = !!tenant.entitlements?.medication_adherence;
  const isAiAgentActive = !!tenant.entitlements?.ai_setup_agent;

  const qrSystem: SystemProduct = {
    id: 'qr-token-system',
    category: 'QUEUE MANAGEMENT',
    name: 'QR Token & OPD Queue System',
    priceLabel: '₹1,199',
    billingFrequency: '/ month + GST',
    status: isQrActive ? 'active' : 'available',
    badge: isQrActive ? 'Active in Clinic' : 'Base Subscription',
    tagline: 'Complete paperless outpatient management & live smartphone queue',
    description:
      'Paperless token standees for clinic entrance, real-time live token tracking on patient WhatsApp, and instant reception check-in verification. Base plan includes up to 3 doctors.',
    highlights: [
      '4 QR Standees Provided to Clinic',
      'Includes up to 3 Doctors',
      'Zero-Fee Direct UPI QR Payments',
      'Thermal Printer & Slip Driver',
      'Unlimited Patient Tokens',
    ],
  };

  const upcomingSystems: SystemProduct[] = [
    {
      id: 'pharmacy-inventory-system',
      category: 'PHARMACY & INVENTORY',
      name: 'Clinic Pharmacy & Stock Dispensing Suite',
      priceLabel: 'Coming Soon',
      billingFrequency: '',
      status: 'coming_soon',
      badge: 'In Development',
      tagline: 'Real-time batch tracking, expiry alerts, and 1-click prescription fulfillment',
      description:
        'Directly linked with doctor consultation prescriptions. Auto-deducts dispensed medicines, prints GST invoices, and flags low stock or near-expiry batches.',
      highlights: ['Direct Doctor Rx Link', 'GST Invoicing', 'Batch & Expiry Monitor', 'Barcode Scanner Ready'],
    },
    {
      id: 'diagnostic-lab-system',
      category: 'DIAGNOSTICS & PATHOLOGY',
      name: 'In-House Diagnostic Lab & Report Portal',
      priceLabel: 'Coming Soon',
      billingFrequency: '',
      status: 'coming_soon',
      badge: 'In Development',
      tagline: 'Sample accessioning, reference ranges, and automated WhatsApp PDF reports',
      description:
        'Order lab tests during doctor consultation, print barcodes for sample collection, and automatically send digitally signed lab test reports to patients on WhatsApp.',
      highlights: ['WhatsApp PDF Dispatch', 'Doctor Test Orders', 'Pathology Normal Ranges', 'Sample Barcode Print'],
    },
  ];

  const addOns: AddOnItem[] = [
    {
      id: 'ai-prescription-ocr',
      name: 'Prescription & Lab Reports AI (OCR & Handwriting)',
      category: 'Clinical AI',
      icon: 'document_scanner',
      priceLabel: '₹399 / month',
      badge: isOcrActive ? 'Active Add-on' : 'AI Powered Add-on',
      description:
        'Snap photos of handwritten doctor prescriptions, paper OPD slips, or diagnostic reports to extract vitals, medicines, dosages, and complaints automatically into structured clinical fields.',
      integrationNote: 'Injects extracted clinical data directly into Doctor Consultation Cabin during live OPD queue.',
      isActive: isOcrActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isOcrActive ? 'Manage Module' : 'Activate Add-on',
    },
    {
      id: 'whatsapp-patient-care',
      name: 'WhatsApp Automation & Dose Reminders',
      category: 'Patient Communication',
      icon: 'chat',
      priceLabel: '₹0.20 per message (wallet)',
      badge: 'Official Meta Cloud API',
      description:
        'Automated WhatsApp alerts to patients when doctor arrives, live turn countdown notifications, digital token slips, and automated medication dosage reminders.',
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
      priceLabel: '₹299 / month',
      badge: isAdvanceBookingActive ? 'Active Add-on' : 'Sync Engine',
      description:
        'Offer scheduled consultation slots on future dates from your public web page with two-way synchronization into doctor personal Google Calendar.',
      integrationNote: 'Synchronizes with Doctor Planned Timings and Public Directory Listing.',
      isActive: isAdvanceBookingActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isAdvanceBookingActive ? 'Manage Add-on' : 'Activate Add-on',
    },
    {
      id: 'time-slot-booking',
      name: 'Time-Slot / Hybrid Booking Engine',
      category: 'Scheduling Engine',
      icon: 'calendar_month',
      priceLabel: '₹299 / month',
      badge: isTimeSlotActive ? 'Active Add-on' : 'Hybrid Queue',
      description:
        'Seamlessly blend fixed-appointment time slots with live walk-in OPD queue tokens so scheduled patients get priority without disrupting queue flow.',
      integrationNote: 'Integrates into reception check-in and queue token issuance engine.',
      isActive: isTimeSlotActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isTimeSlotActive ? 'Manage Add-on' : 'Activate Add-on',
    },
    {
      id: 'medication-adherence',
      name: 'Medication Adherence Engine',
      category: 'Patient Care',
      icon: 'medication',
      priceLabel: '₹299 / month',
      badge: isMedicationActive ? 'Active Add-on' : 'Patient Adherence',
      description:
        'Sends automated WhatsApp medicine schedule reminders and timely refill reminders to chronic and follow-up patients after consultation.',
      integrationNote: 'Triggers automatically when digital prescriptions are finalized by doctor.',
      isActive: isMedicationActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isMedicationActive ? 'Manage Add-on' : 'Activate Add-on',
    },
    {
      id: 'ai-clinic-setup-agent',
      name: 'AI Clinic Setup Agent',
      category: 'Clinical AI',
      icon: 'smart_toy',
      priceLabel: '₹199 / month',
      badge: isAiAgentActive ? 'Active Add-on' : 'AI Assistant',
      description:
        'Upload photos of old Rx pads or doctor duty rosters to auto-configure doctor schedules, session timings, and consultation fee rules.',
      integrationNote: 'Directly configures Doctor Timings and Reception Verification parameters.',
      isActive: isAiAgentActive,
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isAiAgentActive ? 'Manage Add-on' : 'Activate Add-on',
    },
    {
      id: 'voice-clinical-scribe',
      name: 'AI Voice Consultation Scribe (Multilingual)',
      category: 'Clinical AI',
      icon: 'mic',
      priceLabel: 'Early Access · Free Beta',
      badge: 'Hindi + English Speech',
      description:
        'Speak naturally during patient consultations. AI transcribes doctor-patient dialogue, formats chief complaints, diagnosis, and Rx instructions into structured notes.',
      integrationNote: 'Designed to integrate directly into ClinicQ consultation cabin workflow.',
      isActive: false,
      isBeta: true,
      actionLabel: 'Join Early Access',
    },
  ];

  const handleWaitlist = (id: string) => {
    setWaitlistSuccess((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="max-w-6xl flex flex-col gap-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm mb-2 font-medium">
            <Icon name="grid_view" className="text-[16px]" />
            Clinic Systems &amp; Modules
          </div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">
            Clinical Products &amp; Solutions
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Core healthcare operating systems built for modern Indian OPD clinics and hospitals.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href={baseRole === 'doctor' ? '/doctor/hours' : '/manage/team'}
            className="h-10 px-4 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors"
          >
            <Icon name="schedule" className="text-[18px]" />
            Set Timings
          </Link>
          <Link
            href={baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing'}
            className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity"
          >
            <Icon name="account_balance_wallet" className="text-[18px]" />
            Billing &amp; Subscription
          </Link>
        </div>
      </div>

      {/* PRIMARY SYSTEM: QR Token & OPD Queue System */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-label-lg text-label-lg font-bold text-on-surface uppercase tracking-wider text-primary">
            Active Core System
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Full Suite with Physical Standees &amp; WhatsApp Integration
          </span>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border-2 border-primary/20 relative overflow-hidden flex flex-col gap-6">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5 pointer-events-none" />

          {/* Main Card Content */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative">
            <div className="flex-1 max-w-3xl flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-bold tracking-wider uppercase">
                  {qrSystem.category}
                </span>
                <span
                  className={`px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                    isQrActive
                      ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {qrSystem.badge}
                </span>
                <span className="px-3 py-1 rounded-full bg-surface-container-low text-primary font-label-sm text-label-sm font-semibold flex items-center gap-1">
                  <Icon name="local_shipping" className="text-[15px]" /> 4 Physical QR Standees Included
                </span>
              </div>

              <div>
                <h2 className="font-headline-lg md:text-[34px] md:leading-[40px] font-extrabold text-on-surface">
                  {qrSystem.name}
                </h2>
                <p className="font-label-lg text-label-lg text-primary font-semibold mt-1">
                  {qrSystem.tagline}
                </p>
              </div>

              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                {qrSystem.description}
              </p>

              {/* Highlight chips */}
              <div className="flex flex-wrap gap-2 pt-2">
                {qrSystem.highlights.map((h) => (
                  <span
                    key={h}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-surface-container-low text-on-surface font-label-sm text-label-sm border border-surface-container"
                  >
                    <Icon name="check" className="text-tertiary text-[16px]" />
                    {h}
                  </span>
                ))}
              </div>
            </div>

            {/* Pricing Box & Primary Actions */}
            <div className="bg-surface-container-low rounded-2xl p-6 lg:w-[320px] shrink-0 flex flex-col justify-between gap-5 border border-surface-container">
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Subscription Charge
                </p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="font-display-token text-[40px] leading-[44px] font-black text-primary">
                    {qrSystem.priceLabel}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">
                    {qrSystem.billingFrequency}
                  </span>
                </div>
                <p className="font-body-xs text-body-xs text-on-surface-variant mt-1.5">
                  Includes up to 3 Doctors. Additional doctors past 3 at ₹499/month each.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDetailTab('kit');
                    setDetailsOpen(true);
                  }}
                  className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all"
                >
                  <Icon name="info" className="text-[18px]" />
                  View Details &amp; Add-ons
                </button>

                {isQrActive ? (
                  <Link
                    href={baseRole === 'doctor' ? '/doctor/qr-poster' : '/manage/qr'}
                    className="w-full h-10 rounded-xl bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors"
                  >
                    <Icon name="qr_code_2" className="text-[16px]" />
                    Standee &amp; QR Settings
                  </Link>
                ) : (
                  <Link
                    href={baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing'}
                    className="w-full h-10 rounded-xl bg-surface-container-highest text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors"
                  >
                    <Icon name="confirmation_number" className="text-[16px]" />
                    Activate Online Booking
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Quick bar summary inside card */}
          <div className="pt-4 border-t border-surface-container flex flex-wrap items-center justify-between gap-4 text-on-surface-variant font-label-sm text-label-sm">
            <div className="flex items-center gap-6 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Icon name="domain_verification" className="text-tertiary text-[18px]" />
                Physical acrylic delivery dispatched in 3–5 days
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="support_agent" className="text-primary text-[18px]" />
                Dedicated clinic onboarding support
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="security" className="text-primary text-[18px]" />
                100% Clinic Data Privacy &amp; Encrypted Records
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setDetailTab('addons');
                setDetailsOpen(true);
              }}
              className="text-primary font-semibold hover:underline flex items-center gap-1"
            >
              Explore {addOns.length} Integrated Add-ons <Icon name="arrow_forward" className="text-[14px]" />
            </button>
          </div>
        </div>
      </div>

      {/* UPCOMING SYSTEMS ROADMAP */}
      <div className="flex flex-col gap-4 mt-4">
        <div>
          <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
            Upcoming Clinical Systems
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Modular hospital and practice systems currently in development, seamlessly integrable with your QR Token core.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {upcomingSystems.map((sys) => {
            const isInterestSaved = waitlistSuccess[sys.id];
            return (
              <div
                key={sys.id}
                className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col justify-between gap-5 opacity-90 hover:opacity-100 transition-opacity"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-label-xs text-label-xs font-bold uppercase tracking-wider">
                      {sys.category}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-xs text-label-xs font-semibold">
                      {sys.badge}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      {sys.name}
                    </h4>
                    <p className="font-label-sm text-label-sm text-primary font-medium mt-0.5">
                      {sys.tagline}
                    </p>
                  </div>

                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    {sys.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {sys.highlights.map((h) => (
                      <span
                        key={h}
                        className="px-2.5 py-0.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-xs text-label-xs"
                      >
                        • {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-surface-container flex items-center justify-between gap-3">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                    Integrated System
                  </span>
                  <button
                    type="button"
                    disabled={isInterestSaved}
                    onClick={() => handleWaitlist(sys.id)}
                    className="h-9 px-4 rounded-xl bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1.5 hover:bg-surface-container transition-colors disabled:opacity-75"
                  >
                    <Icon name={isInterestSaved ? 'check' : 'notifications'} className="text-[16px]" />
                    {isInterestSaved ? 'Interest Recorded' : 'Notify on Launch'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          FULL PRODUCT DETAILS MODAL (Details, Physical Kit, Add-ons, Terms & Policies)
          ========================================================================= */}
      {detailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-surface-container animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-surface-container flex items-start justify-between gap-4 bg-surface-container-low/50">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-xs text-label-xs font-bold uppercase tracking-wider">
                    {qrSystem.category}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-xs text-label-xs font-semibold">
                    {qrSystem.badge}
                  </span>
                  <span className="text-on-surface-variant font-label-sm text-label-sm font-bold">
                    ₹1,199 / month + GST (Includes up to 3 Doctors)
                  </span>
                </div>
                <h2 className="font-headline-md sm:text-[26px] font-extrabold text-on-surface">
                  {qrSystem.name} — Complete Details
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Everything you get in your clinic setup, physical standees, compatible add-ons, terms, and policies.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container transition-colors shrink-0"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-surface-container bg-surface-container-lowest">
              {[
                { key: 'kit', label: 'What You Get (Hardware & Software)', icon: 'inventory' },
                { key: 'addons', label: `Modular Add-ons (${addOns.length})`, icon: 'extension' },
                { key: 'terms', label: 'Terms, Policies & SLAs', icon: 'gavel' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDetailTab(tab.key as any)}
                  className={`h-11 px-4 font-label-md text-label-md font-semibold flex items-center gap-2 border-b-2 transition-all ${
                    detailTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Icon name={tab.icon} className="text-[18px]" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-170px)] flex flex-col gap-6">
              {/* TAB 1: WHAT YOU GET */}
              {detailTab === 'kit' && (
                <div className="flex flex-col gap-6">
                  {/* Physical Kit Box */}
                  <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                        <Icon name="local_shipping" className="text-[26px]" />
                      </div>
                      <div>
                        <h4 className="font-label-lg text-label-lg font-bold text-on-surface">
                          4 High-Grade Acrylic QR Standees Provided to Clinic
                        </h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                          ClinicQ prints and ships <strong>4 customized acrylic QR standees</strong> with your clinic name, doctor roster, and patient scanning instructions directly to your clinic entrance and reception desks.
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-primary text-on-primary font-label-xs text-label-xs font-bold uppercase shrink-0">
                      Shipped Free
                    </span>
                  </div>

                  {/* Complete Breakdown Grid */}
                  <div>
                    <h4 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-3">
                      Included Platform Features &amp; Capacities
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-bold font-label-md text-label-md">
                          <Icon name="badge" className="text-[20px]" />
                          Includes up to 3 Doctors
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Base plan covers up to 3 practicing doctors with individual public profile pages, dedicated queues, and shift schedules. Each additional doctor beyond 3 is only ₹499/month.
                        </p>
                      </div>

                      <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-bold font-label-md text-label-md">
                          <Icon name="phone_iphone" className="text-[20px]" />
                          Live Patient Mobile Web App
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Zero app downloads required. Patients scan the standee, receive their digital token immediately, and see live turn countdowns with estimated waiting times on their phones.
                        </p>
                      </div>

                      <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-bold font-label-md text-label-md">
                          <Icon name="stethoscope" className="text-[20px]" />
                          Doctor Cabin Command Console
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Works on any tablet, iPad, laptop, or desktop. One-click Next Patient calling, patient vitals review, prescription generation, and instant break/arrival toggles.
                        </p>
                      </div>

                      <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-bold font-label-md text-label-md">
                          <Icon name="desk" className="text-[20px]" />
                          Reception Verifier &amp; Walk-ins
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Fast front-desk check-in for arriving QR patients and manual token issuance for walk-in elderly or non-smartphone patients. Instant phone lookup for recurring records.
                        </p>
                      </div>

                      <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-bold font-label-md text-label-md">
                          <Icon name="currency_rupee" className="text-[20px]" />
                          Zero-Fee Direct UPI QR Payments
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Direct bank-to-bank settlement with 0% gateway commission. Generates dynamic UPI QR codes per token for GPay, PhonePe, Paytm, and BHIM payments with shift cashier reconciliation.
                        </p>
                      </div>

                      <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-bold font-label-md text-label-md">
                          <Icon name="print" className="text-[20px]" />
                          Smart Thermal Printing &amp; Letterhead Driver
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Compatible with standard 58mm and 80mm thermal receipt slip printers via USB or Bluetooth. Also formats digital prescriptions with configurable top/bottom letterhead offsets.
                        </p>
                      </div>

                      <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-bold font-label-md text-label-md">
                          <Icon name="assignment" className="text-[20px]" />
                          Custom Clinical Intake Forms
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Design specialty questionnaires (pediatric history, dental check, vitals, allergies). Patients fill them out on their phone while waiting in the OPD queue.
                        </p>
                      </div>

                      <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary font-bold font-label-md text-label-md">
                          <Icon name="all_inclusive" className="text-[20px]" />
                          Unlimited Tokens &amp; Check-ins
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          No per-patient fees, no check-in caps, and no tiered token limitations. Issue as many tokens as your clinic handles every day.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MODULAR ADD-ONS */}
              {detailTab === 'addons' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Integrated Modular Add-ons
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Enhance your QR Token System with optional clinical AI, Meta WhatsApp automation, and multi-day booking modules.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addOns.map((a) => {
                      const isDone = waitlistSuccess[a.id];
                      return (
                        <div
                          key={a.id}
                          className="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container flex flex-col justify-between gap-3 shadow-sm hover:border-primary/40 transition-colors"
                        >
                          <div className="flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <Icon name={a.icon} className="text-[22px]" />
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full font-label-xs text-label-xs font-semibold ${
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
                              <h5 className="font-label-lg text-label-lg font-bold text-on-surface">
                                {a.name}
                              </h5>
                            </div>

                            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                              {a.description}
                            </p>

                            <div className="bg-surface-container-low rounded-xl p-2.5 text-on-surface-variant font-body-xs text-body-xs flex items-start gap-1.5">
                              <Icon name="link" className="text-primary text-[15px] shrink-0 mt-0.5" />
                              <span>{a.integrationNote}</span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-surface-container flex items-center justify-between gap-3">
                            <div>
                              <span className="font-label-xs text-label-xs text-on-surface-variant uppercase block">
                                Add-on Pricing
                              </span>
                              <span className="font-label-md text-label-md font-bold text-primary">
                                {a.priceLabel}
                              </span>
                            </div>

                            {a.isBeta ? (
                              <button
                                type="button"
                                disabled={isDone}
                                onClick={() => handleWaitlist(a.id)}
                                className="h-9 px-3 rounded-xl bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-1 hover:bg-surface-container transition-colors disabled:opacity-75"
                              >
                                <Icon name={isDone ? 'check' : 'notifications'} className="text-[15px]" />
                                {isDone ? 'Recorded' : a.actionLabel}
                              </button>
                            ) : a.actionHref ? (
                              <Link
                                href={a.actionHref}
                                className={`h-9 px-3 rounded-xl font-label-sm text-label-sm font-semibold flex items-center gap-1 transition-all ${
                                  a.isActive
                                    ? 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                                    : 'bg-primary text-on-primary hover:opacity-95'
                                }`}
                              >
                                <Icon name={a.isActive ? 'settings' : 'add'} className="text-[16px]" />
                                {a.actionLabel}
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: TERMS, POLICIES & SLAs */}
              {detailTab === 'terms' && (
                <div className="flex flex-col gap-6">
                  <div>
                    <h4 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      Terms, Policies &amp; Service Commitments
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Transparent policies designed to give clinics peace of mind without hidden fees or lock-ins.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-surface-container-low rounded-2xl p-5 border border-surface-container">
                      <h5 className="font-label-lg text-label-lg font-bold text-on-surface flex items-center gap-2">
                        <Icon name="local_shipping" className="text-primary text-[20px]" />
                        1. Physical Standee Dispatch &amp; Replacements
                      </h5>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                        Every subscribing clinic receives <strong>4 customized acrylic QR standees</strong> with high-resolution UV print. Standees are manufactured and dispatched to your clinic postal address within 3 to 5 business days after signup verification. If a standee gets damaged or your clinic adds a new counter, replacement standees can be ordered at cost price, and high-resolution printable vector PDFs are always available free in your dashboard.
                      </p>
                    </div>

                    <div className="bg-surface-container-low rounded-2xl p-5 border border-surface-container">
                      <h5 className="font-label-lg text-label-lg font-bold text-on-surface flex items-center gap-2">
                        <Icon name="payments" className="text-primary text-[20px]" />
                        2. Billing &amp; Doctor Capacity Tiers
                      </h5>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                        The core subscription is billed monthly at <strong>₹1,199 / month + GST</strong> and includes up to <strong>3 practicing doctors</strong>. Clinics with more than 3 doctors are billed at <strong>₹499 / month + GST</strong> for each additional doctor beyond 3. There are no annual lock-ins, setup fees, or hidden per-token costs.
                      </p>
                    </div>

                    <div className="bg-surface-container-low rounded-2xl p-5 border border-surface-container">
                      <h5 className="font-label-lg text-label-lg font-bold text-on-surface flex items-center gap-2">
                        <Icon name="lock" className="text-primary text-[20px]" />
                        3. Data Ownership &amp; Medical Privacy
                      </h5>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                        Your clinic owns <strong>100% of all patient records, consultation notes, and visit history</strong>. ClinicQ strictly complies with healthcare privacy guidelines. Patient and clinical data are encrypted in transit and at rest. We never sell, monetize, or share your patient contacts or health data with third parties.
                      </p>
                    </div>

                    <div className="bg-surface-container-low rounded-2xl p-5 border border-surface-container">
                      <h5 className="font-label-lg text-label-lg font-bold text-on-surface flex items-center gap-2">
                        <Icon name="cancel" className="text-primary text-[20px]" />
                        4. Cancellation &amp; Refund Policy
                      </h5>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                        Subscriptions run on a month-to-month cycle. You can cancel your subscription at any time with one click from your Billing screen. Your account will remain active until the end of the paid billing period, with zero cancellation penalties. You can export all your past records and patient data at any time.
                      </p>
                    </div>

                    <div className="bg-surface-container-low rounded-2xl p-5 border border-surface-container">
                      <h5 className="font-label-lg text-label-lg font-bold text-on-surface flex items-center gap-2">
                        <Icon name="support_agent" className="text-primary text-[20px]" />
                        5. Support, SLA &amp; Onboarding
                      </h5>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                        Every clinic is assigned an onboarding specialist to help setup doctor consultation hours, configure thermal receipt printers, and train front-desk reception staff. Technical support is available via WhatsApp and phone from 9:00 AM to 8:00 PM IST Monday through Saturday.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-surface-container bg-surface-container-low/50 flex flex-wrap items-center justify-between gap-3">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Billed by ClinicQ, operated by Altis Labs · PAN GRTPK1849H · Udyam UDYAM-BR-34-0066884
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="h-10 px-4 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors"
                >
                  Close
                </button>
                <Link
                  href={baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing'}
                  className="h-10 px-5 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity"
                >
                  <Icon name="account_balance_wallet" className="text-[18px]" />
                  Subscription &amp; Billing
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
