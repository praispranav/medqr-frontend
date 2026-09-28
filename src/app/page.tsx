import Link from 'next/link';

// Marketing landing. Ported from
// stitch_medqr_clinic_suite_ui_design/medqr_landing_digital_queue_clinic_suite/code.html.
// The design's social proof ("200+ clinics", testimonials, uptime %) is left out on purpose — we
// don't have those numbers yet and shouldn't publish invented ones. Trial/demo-booking CTAs point at
// the live product demo instead, since there's no signup flow yet. Prices match /billing/catalog.

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

export default function LandingPage() {
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
            <a href="#features" className="hover:text-on-surface">Features</a>
            <a href="#modes" className="hover:text-on-surface">Queue modes</a>
            <a href="#pricing" className="hover:text-on-surface">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            
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
            <Link href="/patient/drkumar" className="h-14 px-6 inline-flex items-center gap-2 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md">
              Try it as a patient <Icon name="arrow_forward" className="text-[20px]" />
            </Link>
            <Link href="/doctor/dashboard" className="h-14 px-6 inline-flex items-center gap-2 rounded-xl bg-surface-container-lowest text-primary font-label-lg text-label-lg shadow-sm">
              <Icon name="stethoscope" className="text-[20px]" /> Open doctor suite
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 font-body-sm text-body-sm text-on-surface-variant">
            <li className="flex items-center gap-1.5"><Icon name="check_circle" className="text-tertiary text-[16px]" /> Works on budget Android phones</li>
            <li className="flex items-center gap-1.5"><Icon name="check_circle" className="text-tertiary text-[16px]" /> Keeps your paper Rx workflow</li>
            <li className="flex items-center gap-1.5"><Icon name="check_circle" className="text-tertiary text-[16px]" /> No app download for patients</li>
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

      {/* Modes */}
      <section id="modes" className="max-w-6xl mx-auto px-4 py-16">
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
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-surface-container-low py-16">
        <div className="max-w-6xl mx-auto px-4">
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
                  'Unlimited tokens, no per-patient fees',
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <Icon name="check_circle" className="text-tertiary text-[18px] mt-0.5" /> {x}
                  </li>
                ))}
              </ul>
              <Link href="/doctor/dashboard" className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 mt-2">
                See the doctor suite <Icon name="arrow_forward" className="text-[20px]" />
              </Link>
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
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-primary-container text-on-primary rounded-3xl p-8 lg:p-12 flex flex-col gap-5">
          <h2 className="font-headline-lg text-headline-lg max-w-2xl">Ready to turn your clinic into a smooth, crowd-free practice?</h2>
          <p className="font-body-lg text-body-lg opacity-90 max-w-xl">
            Print your QR standee, put it on the counter, and your first patient can join the digital queue in minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/patient/drkumar" className="h-12 px-5 inline-flex items-center rounded-xl bg-white text-primary font-label-lg text-label-lg">
              Try the patient flow
            </Link>
            <Link href="/doctor/qr-poster" className="h-12 px-5 inline-flex items-center gap-2 rounded-xl bg-on-primary/15 font-label-lg text-label-lg">
              <Icon name="qr_code_2" className="text-[20px]" /> Make my QR standee
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-surface-container">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row gap-3 justify-between font-body-sm text-body-sm text-on-surface-variant">
          <p>© {new Date().getFullYear()} MedQR · Digital OPD queues for Indian clinics</p>
          <div className="flex gap-4">
            <Link href="/login">Doctor/Staff Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
