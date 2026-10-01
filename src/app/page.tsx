'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

// Marketing landing. Ported from
// stitch_medqr_clinic_suite_ui_design/medqr_landing_digital_queue_clinic_suite/code.html.
// The design's social proof ("200+ clinics", testimonials, uptime %) is left out on purpose — we
// don't have those numbers yet and shouldn't publish invented ones. Prices match /billing/catalog.
// "Start free trial" captures a lead for platform admin to review (no self-serve tenant creation yet).
// "See the doctor suite" one-click-logs into a permanent, read-only demo clinic — no password, no risk.

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={`material-symbols-outlined leading-none ${className}`}>
      {name}
    </span>
  );
}

const FEATURES = [
  {
    icon: 'qr_code_scanner',
    title: '10-second QR check-in',
    body: 'Patients scan a printed counter QR. Returning patients check in with one tap; new ones type a name and mobile number. No app download.',
  },
  {
    icon: 'edit_note',
    title: 'Zero-typing consultation',
    body: 'One free-text note or a photo of your usual prescription pad. No EMR forms, no ICD pickers, no dictation gadgets.',
  },
  {
    icon: 'cell_tower',
    title: 'Live queue on every phone',
    body: 'Patients see who is in the cabin and how many are ahead. When you call the next token, their phone says “It’s your turn”.',
  },
];

const ADD_ONS = [
  ['document_scanner', 'Prescription OCR', 'Structured medicines & vitals from a photo', 499],
  ['text_snippet', 'Prescription Image-to-Text', 'Handwriting to plain searchable text', 399],
  ['print', 'Letterhead & thermal print driver', 'Offset letterhead and 58/80mm slips', 349],
] as const;

// Why a clinic actually switches — not feature bullets, the problems those features solve.
const PROBLEMS = [
  {
    icon: 'calendar_month',
    title: 'Patients can book from anywhere',
    body: 'A patient joins the queue from home, in the car, or at the counter — the same QR, the same token number either way.',
  },
  {
    icon: 'groups_2',
    title: 'No more crowd at reception',
    body: 'Self check-in and a live queue on every phone mean reception isn’t the bottleneck for "how long is the wait".',
  },
  {
    icon: 'monitor_heart',
    title: 'Better patient visit tracking',
    body: 'Every visit, note, attachment and payment is tied to the patient’s history — searchable the next time they walk in.',
  },
  {
    icon: 'shield',
    title: 'Financial safety, with AI',
    body: 'Every rupee collected online or at the counter is logged and reconciled; AI add-ons flag mismatched or duplicate payments for review.',
  },
];

const FEATURE_LIST = [
  'QR-based digital token queue, live on every patient’s phone',
  'Returning patients check in with one tap — new ones in under 10 seconds',
  'Pre-session booking: an early token even before the doctor’s shift starts',
  'Advance booking for a future day, only when the doctor actually has a session then',
  'Reception verifier — check in by token, phone or name, plus walk-in registration',
  'Optional vitals (BP, weight, height, temp, SpO2) — never forced, never shown empty',
  'Doctor Queue Command Center — call next, jump priority, mark no-show',
  'Free-text consultation notes with photo attachments, from doctor, reception or patient',
  'Flexible doctor shifts — start/end, open-ended breaks, "running late" delay',
  'Per-doctor payment mode — cash at counter, prepay, or pay after consultation',
  'Instant UPI QR payments — a failed or skipped payment never blocks a patient being seen',
  'WhatsApp alerts — token confirmed, you’re next, your turn',
  'Optional WhatsApp OTP verification at check-in, switchable per clinic',
  'Multi-doctor clinic admin — shared staff, queue rules and billing across doctors',
  'Admin-generated staff logins with WhatsApp-delivered password resets',
  'Printable QR standees — ready-to-print posters, PDF or PNG export',
  'Custom intake forms — included in the base plan, not a paid add-on',
  '14-day free trial, then simple monthly autopay with a 30-day grace period',
];

type FlowStep = { icon: string; label: string };
const FLOWS: { title: string; steps: FlowStep[] }[] = [
  {
    title: 'Solo doctor, no reception',
    steps: [
      { icon: 'qr_code_scanner', label: 'Patient scans QR' },
      { icon: 'confirmation_number', label: 'Token issued' },
      { icon: 'stethoscope', label: 'Doctor calls next' },
      { icon: 'edit_note', label: 'Note & done' },
    ],
  },
  {
    title: 'With reception',
    steps: [
      { icon: 'qr_code_scanner', label: 'Patient scans QR' },
      { icon: 'how_to_reg', label: 'Reception verifies' },
      { icon: 'stethoscope', label: 'Doctor calls next' },
      { icon: 'payments', label: 'Payment at counter' },
    ],
  },
  {
    title: 'Multiple doctors',
    steps: [
      { icon: 'groups', label: 'Patient picks doctor' },
      { icon: 'confirmation_number', label: "Joins that doctor's queue" },
      { icon: 'admin_panel_settings', label: 'Clinic admin oversees all' },
      { icon: 'meeting_room', label: 'Each doctor runs their cabin' },
    ],
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialDays, setTrialDays] = useState<number | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');

  useEffect(() => {
    api.getBillingCatalog().then((c) => setTrialDays(c.trial_days)).catch(() => undefined);
  }, []);

  const openDoctorSuite = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      await api.demoLogin();
      router.push('/doctor/dashboard');
    } catch (e) {
      setDemoError(e instanceof ApiError ? e.message : 'Could not open the demo right now.');
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-surface-container">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
              <Icon name="qr_code_2" className="text-[22px]" />
            </span>
            <span className="font-headline-sm text-headline-sm text-primary">MedQR</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 ml-6 font-label-md text-label-md text-on-surface-variant">
            <Link href="/doctors" className="hover:text-on-surface">Find a doctor</Link>
            <a href="#features" className="hover:text-on-surface">Features</a>
            <a href="#flows" className="hover:text-on-surface">How it runs</a>
            <a href="#pricing" className="hover:text-on-surface">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setTrialOpen(true)} className="h-10 px-4 inline-flex items-center rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md">
              Start free trial
            </button>
            <Link href="/login" className="h-10 px-4 inline-flex items-center rounded-xl bg-primary text-on-primary font-label-md text-label-md">
              Doctor/Staff Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-14 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="flex flex-col gap-5">
          <span className="self-start px-3 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm uppercase">
            Zero hardware · set up in 15 minutes
          </span>
          <h1 className="font-headline-lg text-[44px] leading-[50px] tracking-tight font-extrabold text-on-surface">
            No more crowds in your waiting room.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
            Digital token queues, instant QR check-in and paper-friendly prescriptions — built for busy Indian OPDs. Zero typing,
            zero clinic chaos.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setTrialOpen(true)} className="h-14 px-6 inline-flex items-center gap-2 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md">
              Start {trialDays ? `your free ${trialDays}-day trial` : 'free trial'} <Icon name="arrow_forward" className="text-[20px]" />
            </button>
            <Link href="/patient/drkumar" className="h-14 px-6 inline-flex items-center gap-2 rounded-xl bg-surface-container-lowest text-primary font-label-lg text-label-lg shadow-sm">
              Try it as a patient
            </Link>
          </div>
          <button onClick={openDoctorSuite} disabled={demoLoading} className="self-start font-label-md text-label-md text-primary flex items-center gap-1.5 disabled:opacity-60">
            <Icon name="stethoscope" className="text-[18px]" /> {demoLoading ? 'Opening demo…' : 'See the doctor suite (live read-only demo)'}
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/doctors${doctorSearch.trim() ? `?q=${encodeURIComponent(doctorSearch.trim())}` : ''}`);
            }}
            className="flex items-center bg-surface-container-lowest rounded-xl shadow-sm h-12 px-2 max-w-md"
          >
            <Icon name="search" className="text-[20px] text-on-surface-variant ml-1.5" />
            <input
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
              placeholder="Already a patient? Find your doctor…"
              className="flex-1 bg-transparent px-2 font-body-md text-body-md focus:outline-none"
            />
            <button className="h-9 px-4 rounded-lg bg-surface-container-low text-primary font-label-md text-label-md">Search</button>
          </form>
          {demoError && <p className="font-body-sm text-body-sm text-error">{demoError}</p>}
          <ul className="flex flex-wrap gap-x-5 gap-y-2 font-body-sm text-body-sm text-on-surface-variant">
            <li className="flex items-center gap-1.5"><Icon name="check_circle" className="text-tertiary text-[16px]" /> No app download — works in any browser</li>
            <li className="flex items-center gap-1.5"><Icon name="check_circle" className="text-tertiary text-[16px]" /> Works on budget Android phones</li>
            <li className="flex items-center gap-1.5"><Icon name="check_circle" className="text-tertiary text-[16px]" /> See your live position from anywhere</li>
            <li className="flex items-center gap-1.5"><Icon name="check_circle" className="text-tertiary text-[16px]" /> WhatsApp alert the moment it's your turn</li>
          </ul>
        </div>

        {/* Product mock */}
        <div className="relative">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center">RK</span>
              <div>
                <p className="font-label-lg text-label-lg">Dr. Ravi Kumar</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">General Physician · Cabin 1</p>
              </div>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm">Queue live</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container-low rounded-xl p-3">
                <p className="font-label-sm text-label-sm text-on-surface-variant">NOW SERVING</p>
                <p className="font-numeric-metric text-numeric-metric text-primary">#45</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <p className="font-label-sm text-label-sm text-on-surface-variant">UP NEXT</p>
                <p className="font-numeric-metric text-numeric-metric text-on-surface">#46</p>
              </div>
            </div>
            {[['47', 'Pooja V.', 'Fever'], ['48', 'Vikram M.', 'Follow-up']].map(([n, name, why]) => (
              <div key={n} className="flex items-center gap-3 bg-surface-container-low rounded-xl p-3">
                <span className="font-headline-sm text-headline-sm text-primary w-10">#{n}</span>
                <span className="flex-1 font-label-md text-label-md">{name}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{why}</span>
              </div>
            ))}
          </div>
          <div className="absolute -bottom-8 -right-2 sm:right-6 w-44 bg-primary-container text-on-primary rounded-2xl shadow-xl p-4 text-center">
            <p className="font-label-sm text-label-sm opacity-90">YOUR LIVE TOKEN</p>
            <p className="font-display-token text-[44px] leading-[48px] font-extrabold">#46</p>
            <p className="font-body-sm text-body-sm">You&apos;re next · stay close</p>
          </div>
        </div>
      </section>

      {/* Problems solved */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <p className="font-label-sm text-label-sm text-primary uppercase tracking-wider">Why clinics switch</p>
        <h2 className="font-headline-lg text-headline-lg mt-2">The actual problems a crowded OPD has</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex gap-4">
              <span className="w-11 h-11 rounded-xl bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
                <Icon name={p.icon} className="text-[24px]" />
              </span>
              <div>
                <h3 className="font-headline-sm text-headline-sm">{p.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-surface-container-low py-16">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-center font-label-sm text-label-sm text-primary uppercase tracking-wider">Engineered for high-density OPDs</p>
          <h2 className="text-center font-headline-lg text-headline-lg mt-2">Built for real-world Indian clinics</h2>
          <p className="text-center font-body-md text-body-md text-on-surface-variant mt-2 max-w-xl mx-auto">
            Doctors don&apos;t want to be data-entry clerks. MedQR keeps your normal clinical pace while digitising the rest.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-3">
                <span className="w-11 h-11 rounded-xl bg-primary-fixed/50 text-primary flex items-center justify-center">
                  <Icon name={f.icon} className="text-[24px]" />
                </span>
                <h3 className="font-headline-sm text-headline-sm">{f.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flows — shown, not explained */}
      <section id="flows" className="max-w-6xl mx-auto px-4 py-16">
        <p className="font-label-sm text-label-sm text-primary uppercase tracking-wider">Three ways to run it</p>
        <h2 className="font-headline-lg text-headline-lg mt-2">Works the way your clinic is staffed</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
          {FLOWS.map((flow) => (
            <div key={flow.title} className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h3 className="font-headline-sm text-headline-sm">{flow.title}</h3>
              <div className="flex flex-col gap-2">
                {flow.steps.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <span className="w-9 h-9 rounded-full bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
                        <Icon name={s.icon} className="text-[18px]" />
                      </span>
                      {i < flow.steps.length - 1 && <span className="w-px h-5 bg-outline-variant" />}
                    </div>
                    <p className="font-label-md text-label-md pb-5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modes */}
      <section id="modes" className="bg-surface-container-low py-16">
        <div className="max-w-6xl mx-auto px-4">
          <p className="font-label-sm text-label-sm text-primary uppercase tracking-wider">Configurable OPD logic</p>
          <h2 className="font-headline-lg text-headline-lg mt-2">Works the way your clinic already runs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[
              ['Token only', 'Classic first-come, first-served token numbers. Ideal for walk-in heavy OPDs.', 'Included', false],
              ['Time-slot only', 'Fixed appointment windows for specialists who run on bookings.', 'Coming soon', false],
              ['Hybrid', 'Weaves booked appointments into the walk-in token flow automatically.', 'Coming soon', true],
            ].map(([title, body, tag, highlight]) => (
              <div key={title as string} className={`rounded-2xl p-6 flex flex-col gap-3 ${highlight ? 'bg-primary-fixed/20 ring-2 ring-primary' : 'bg-surface-container-lowest shadow-sm'}`}>
                <span className="self-start px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface-variant">{tag}</span>
                <h3 className="font-headline-sm text-headline-sm">{title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-center font-headline-lg text-headline-lg">Start low. Add modules only when you need them.</h2>
        <p className="text-center font-body-md text-body-md text-on-surface-variant mt-2">No annual lock-in.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-md flex flex-col gap-4">
            <p className="font-label-sm text-label-sm text-primary uppercase">Core base plan</p>
            <p className="font-display-token text-display-token text-on-surface">
              ₹1,199<span className="font-body-md text-body-md text-on-surface-variant font-normal"> / month + GST</span>
            </p>
            <ul className="flex flex-col gap-2 font-body-md text-body-md">
              {[
                'Unlimited QR check-ins with a printable clinic standee',
                'Live queue on patient phones — no app download',
                'Doctor Queue Command Center on any tablet or laptop',
                'Reception verifier with walk-in registration',
                'Custom intake forms — included, not a paid add-on',
                'Unlimited tokens, no per-patient fees',
              ].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <Icon name="check_circle" className="text-tertiary text-[18px] mt-0.5" /> {x}
                </li>
              ))}
            </ul>
            <button onClick={openDoctorSuite} disabled={demoLoading} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
              {demoLoading ? 'Opening demo…' : 'See the doctor suite'} <Icon name="arrow_forward" className="text-[20px]" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <p className="font-label-lg text-label-lg">Clinic add-ons</p>
            {ADD_ONS.map(([icon, name, body, price]) => (
              <div key={name} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg bg-primary-fixed/40 text-primary flex items-center justify-center shrink-0">
                  <Icon name={icon} className="text-[22px]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-label-lg text-label-lg">{name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{body}</p>
                </div>
                <p className="font-headline-sm text-headline-sm whitespace-nowrap">₹{price}<span className="font-body-sm text-body-sm text-on-surface-variant">/mo</span></p>
              </div>
            ))}
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
                <Icon name="chat" className="text-[22px]" />
              </span>
              <div className="flex-1">
                <p className="font-label-lg text-label-lg">WhatsApp token alerts</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Prepaid wallet, pay per message</p>
              </div>
              <p className="font-headline-sm text-headline-sm whitespace-nowrap">₹0.20<span className="font-body-sm text-body-sm text-on-surface-variant">/msg</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Complete feature list */}
      <section className="bg-surface-container-low py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-center font-headline-lg text-headline-lg">Everything that&apos;s actually built</h2>
          <p className="text-center font-body-md text-body-md text-on-surface-variant mt-2 max-w-xl mx-auto">
            No roadmap items on this list — every line here is live in the product today.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mt-10 font-body-md text-body-md">
            {FEATURE_LIST.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Icon name="check_circle" className="text-tertiary text-[18px] mt-0.5 shrink-0" /> {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-primary-container text-white rounded-3xl p-8 lg:p-12 flex flex-col gap-5">
          <h2 className="font-headline-lg text-headline-lg max-w-2xl text-white">Ready to turn your clinic into a smooth, crowd-free practice?</h2>
          <p className="font-body-lg text-body-lg text-white/90 max-w-xl">
            Print your QR standee, put it on the counter, and your first patient can join the digital queue in minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setTrialOpen(true)} className="h-12 px-5 inline-flex items-center rounded-xl bg-white text-primary font-label-lg text-label-lg">
              Start free trial
            </button>
            <Link href="/patient/drkumar" className="h-12 px-5 inline-flex items-center rounded-xl bg-white/15 text-white font-label-lg text-label-lg">
              Try the patient flow
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-surface-container">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row gap-3 justify-between font-body-sm text-body-sm text-on-surface-variant">
          <p>© {new Date().getFullYear()} MedQR · Digital OPD queues for Indian clinics</p>
          <div className="flex gap-4">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/login">Doctor/Staff Login</Link>
          </div>
        </div>
      </footer>

      {trialOpen && <StartTrialModal trialDays={trialDays} onClose={() => setTrialOpen(false)} />}
    </div>
  );
}

function StartTrialModal({ trialDays, onClose }: { trialDays: number | null; onClose: () => void }) {
  const [clinicName, setClinicName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.submitTrialLead({ clinic_name: clinicName, contact_name: contactName, phone, email: email || undefined, city: city || undefined, message: message || undefined });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit right now — try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <Icon name="check_circle" className="text-tertiary text-[36px]" />
            <h2 className="font-headline-md text-headline-md">Request received</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              MedQR will reach out on your number shortly to set up your clinic{trialDays ? ` on a free ${trialDays}-day trial` : ''}.
            </p>
            <button onClick={onClose} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg">
              Close
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md">Start your{trialDays ? ` free ${trialDays}-day` : ' free'} trial</h2>
              <button onClick={onClose} aria-label="Close" className="text-on-surface-variant">
                <Icon name="close" className="text-[22px]" />
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant -mt-2">We&apos;ll call you to set up your clinic — no card needed now.</p>
            <input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Clinic name" className="h-12 rounded-xl bg-surface-container-low px-4 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" className="h-12 rounded-xl bg-surface-container-low px-4 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10-digit mobile number" className="h-12 rounded-xl bg-surface-container-low px-4 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="h-12 rounded-xl bg-surface-container-low px-4 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" className="h-12 rounded-xl bg-surface-container-low px-4 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything else? (optional)" rows={2} className="rounded-xl bg-surface-container-low px-4 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
            <button
              disabled={submitting || !clinicName.trim() || !contactName.trim() || phone.length !== 10}
              onClick={submit}
              className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Request my free trial'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
