'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/patient/ui';
import type { Tenant } from '@/lib/api';

interface ProductItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  pricingType: 'free' | 'paid' | 'usage' | 'beta';
  priceLabel: string;
  badge: string;
  description: string;
  integrationNote: string;
  status: 'active' | 'available' | 'request' | 'waitlist';
  actionHref?: string;
  actionLabel: string;
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
  const [filter, setFilter] = useState<'all' | 'free' | 'paid' | 'ai'>('all');
  const [waitlistSuccess, setWaitlistSuccess] = useState<Record<string, boolean>>({});

  const isQrActive = tenant.directory_products ? tenant.directory_products.includes('qr-token-system') : tenant.qr_enabled !== false;
  const isOcrActive = !!tenant.entitlements?.prescription_ocr;
  const isAdvanceBookingActive = !!tenant.entitlements?.advance_booking;

  const products: ProductItem[] = [
    {
      id: 'qr-token-system',
      name: 'QR Token & OPD Queue System',
      category: 'Queue Management',
      icon: 'qr_code_2',
      pricingType: 'paid',
      priceLabel: '₹1,199 / month (Includes 3 Doctors)',
      badge: isQrActive ? 'Active Plan' : 'Base Subscription',
      description: 'Paperless token standees for clinic entrance, real-time live token tracking on patient WhatsApp, and instant reception check-in verification. Base plan includes up to 3 doctors.',
      integrationNote: 'Fully integrated with Doctor Queue, Reception Verifier & Patient Mobile Web App.',
      status: isQrActive ? 'active' : 'available',
      actionHref: isQrActive
        ? baseRole === 'doctor'
          ? '/doctor/qr-poster'
          : '/manage/qr'
        : baseRole === 'doctor'
        ? '/doctor/billing'
        : '/manage/billing',
      actionLabel: isQrActive ? 'Standee & QR Settings' : 'Get Online OPD Booking',
    },
    {
      id: 'ai-prescription-ocr',
      name: 'AI Prescription OCR & Digitizer',
      category: 'Clinical AI',
      icon: 'document_scanner',
      pricingType: 'paid',
      priceLabel: '₹399 / month',
      badge: isOcrActive ? 'Active Add-on' : 'AI Powered Add-on',
      description: 'Snap photos of handwritten doctor prescriptions, paper OPD slips, or diagnostic reports to automatically extract vitals, medicines, dosages, and complaints.',
      integrationNote: 'Injects extracted clinical data directly into Doctor Consultation Workspace.',
      status: isOcrActive ? 'active' : 'request',
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: isOcrActive ? 'Manage Module' : 'Activate Add-on',
    },
    {
      id: 'smart-thermal-printer',
      name: 'Smart Letterhead & Thermal Printer Tool',
      category: 'Clinic Hardware',
      icon: 'print',
      pricingType: 'free',
      priceLabel: 'Free Built-in Tool',
      badge: 'Zero Driver Setup',
      description: 'Print paper token slips instantly on 58mm / 80mm thermal printers, or print digital prescriptions with precise letterhead top/bottom offset alignment.',
      integrationNote: 'Compatible with standard USB, Bluetooth & desktop thermal receipt printers.',
      status: 'active',
      actionHref: baseRole === 'doctor' ? '/doctor/qr-poster' : '/manage/qr',
      actionLabel: 'Print & Standee Tools',
    },
    {
      id: 'whatsapp-patient-care',
      name: 'WhatsApp Automation & Dose Reminders',
      category: 'Patient Communication',
      icon: 'chat',
      pricingType: 'usage',
      priceLabel: '₹0.20 per WhatsApp message',
      badge: 'Official Meta Cloud API',
      description: 'Send automated WhatsApp messages to patients when doctor arrives, turn countdown alerts, digital token download links, and medication dosage reminders.',
      integrationNote: 'Connected directly to clinic WhatsApp sender wallet with live delivery receipts.',
      status: 'active',
      actionHref: baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing',
      actionLabel: 'Manage WhatsApp Wallet',
    },
    {
      id: 'upi-instant-payments',
      name: 'Zero-Commission UPI QR Payments',
      category: 'Fintech & Billing',
      icon: 'currency_rupee',
      pricingType: 'free',
      priceLabel: 'Free Built-in Tool · 0% Fee',
      badge: 'Instant Bank Settlement',
      description: 'Generate dynamic UPI QR codes per patient token. Patients scan and pay using GPay, PhonePe, Paytm, or BHIM directly into the clinic or doctor bank account.',
      integrationNote: 'Reconciles instantly in Payments Ledger and Daily Shift Cashier reports.',
      status: 'active',
      actionHref: baseRole === 'doctor' ? '/doctor/online-payments' : '/manage/online-payments',
      actionLabel: 'Configure UPI Gateway',
    },
    {
      id: 'custom-intake-builder',
      name: 'Custom Patient Intake Form Builder',
      category: 'Clinical Records',
      icon: 'assignment',
      pricingType: 'free',
      priceLabel: 'Free Built-in Tool',
      badge: 'Customizable',
      description: 'Design clinical intake questionnaires tailored to your specialty (pediatric history, dental checkup questions, vitals, allergies). Patients fill before consultation.',
      integrationNote: 'Responses appear in real time on the Doctor Consultation screen before patient entry.',
      status: 'active',
      actionHref: '/doctor/intake-form',
      actionLabel: 'Open Form Builder',
    },
    {
      id: 'advance-calendar-booking',
      name: 'Multi-Day Online Booking & Google Sync',
      category: 'Scheduling Engine',
      icon: 'event_available',
      pricingType: 'paid',
      priceLabel: 'Included with Advance Booking Add-on',
      badge: isAdvanceBookingActive ? 'Active' : 'Sync Engine',
      description: 'Offer scheduled consultation slots on future dates from your public web page with two-way synchronization into doctor personal Google Calendar.',
      integrationNote: 'Synchronizes with Doctor Planned Timings and Public Directory Listing.',
      status: isAdvanceBookingActive ? 'active' : 'request',
      actionHref: baseRole === 'doctor' ? '/doctor/hours' : '/manage/team',
      actionLabel: 'Configure Timings & Slots',
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
      integrationNote: 'Designed to integrate seamlessly into ClinicQ consultation cabin workflow.',
      status: 'waitlist',
      actionLabel: 'Join Early Access',
    },
  ];

  const filteredProducts = products.filter((p) => {
    if (filter === 'free') return p.pricingType === 'free';
    if (filter === 'paid') return p.pricingType === 'paid' || p.pricingType === 'usage';
    if (filter === 'ai') return p.category.includes('AI');
    return true;
  });

  const handleWaitlist = (id: string) => {
    setWaitlistSuccess((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      {/* Hero Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-fixed/40 text-on-primary-fixed-variant font-label-sm text-label-sm mb-3">
            <Icon name="apps" className="text-[16px]" />
            ClinicQ Ecosystem &amp; Tools
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Products &amp; Integrated Tools
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1.5 max-w-2xl">
            Modular tools built specifically for doctors and clinic managers in India. Free built-in tools and optional paid clinical add-ons — all deeply integrated with your ClinicQ system.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Link
            href={baseRole === 'doctor' ? '/doctor/hours' : '/manage/team'}
            className="h-11 px-4 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-surface-container transition-colors"
          >
            <Icon name="schedule" className="text-[18px]" />
            Set Timings
          </Link>
          <Link
            href={baseRole === 'doctor' ? '/doctor/billing' : '/manage/billing'}
            className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
          >
            <Icon name="account_balance_wallet" className="text-[18px]" />
            Subscription &amp; Add-ons
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: 'all', label: 'All Products & Tools', count: products.length },
          { key: 'free', label: 'Free & Built-in', count: products.filter((p) => p.pricingType === 'free').length },
          { key: 'paid', label: 'Paid & Add-ons', count: products.filter((p) => p.pricingType === 'paid' || p.pricingType === 'usage').length },
          { key: 'ai', label: 'Clinical AI Tools', count: products.filter((p) => p.category.includes('AI')).length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key as any)}
            className={`h-10 px-4 rounded-xl font-label-md text-label-md flex items-center gap-2 shrink-0 transition-colors ${
              filter === tab.key
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[12px] font-bold ${
                filter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.map((p) => {
          const isDone = waitlistSuccess[p.id];
          return (
            <div
              key={p.id}
              className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-container flex flex-col justify-between gap-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-12 h-12 rounded-xl bg-primary-fixed/40 text-primary flex items-center justify-center shrink-0">
                    <Icon name={p.icon} className="text-[26px]" />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold shrink-0 ${
                      p.status === 'active'
                        ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                        : p.pricingType === 'free'
                        ? 'bg-primary-fixed/40 text-on-primary-fixed-variant'
                        : 'bg-secondary-fixed text-on-secondary-fixed'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>

                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">
                    {p.category}
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-0.5">
                    {p.name}
                  </h3>
                </div>

                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  {p.description}
                </p>

                <div className="bg-surface-container-low rounded-xl p-3 flex items-start gap-2 text-on-surface-variant font-body-sm text-body-sm">
                  <Icon name="link" className="text-primary text-[18px] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-on-surface">Integration:</strong> {p.integrationNote}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-surface-container flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Pricing</span>
                  <span className="font-label-md text-label-md font-bold text-primary">
                    {p.priceLabel}
                  </span>
                </div>

                {p.status === 'waitlist' ? (
                  <button
                    type="button"
                    disabled={isDone}
                    onClick={() => handleWaitlist(p.id)}
                    className="w-full h-11 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-container active:scale-[0.99] transition-all disabled:opacity-75"
                  >
                    <Icon name={isDone ? 'check' : 'notifications'} className="text-[18px]" />
                    {isDone ? 'Interest Recorded' : p.actionLabel}
                  </button>
                ) : p.actionHref ? (
                  <Link
                    href={p.actionHref}
                    className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all"
                  >
                    <Icon name="arrow_forward" className="text-[18px]" />
                    {p.actionLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Integration Notice */}
      <div className="bg-surface-container-low rounded-2xl p-5 flex items-start gap-3.5 border border-surface-container">
        <Icon name="hub" className="text-primary text-[24px] shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-label-lg text-label-lg font-bold text-on-surface">
            Building custom tools for your clinic?
          </h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            ClinicQ supports custom EHR data connectors, pharmacy dispatch integrations, and hospital management system (HMS) API bridges. Contact our team to explore tailored clinical tools.
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
