'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, shrinkImage, type AccountOverview, type DirectoryClinicSummary, type Me } from '@/lib/api';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Icon, LoadingPage } from '@/components/patient/ui';
import { homeFor } from '@/lib/staffRoutes';
import { patientUrl } from '@/lib/clinicHost';
import { useHost } from '@/lib/useHost';

// Decision 68 — one sign-in for everyone: mobile → WhatsApp code → continue as a patient, open your clinic,
// add your clinic (live after ClinicQ checks the documents) or ask to join a clinic as a doctor.

type Step = 'mobile' | 'code' | 'choose' | 'who' | 'signup' | 'join' | 'joined';

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <SignIn />
    </Suspense>
  );
}

const field = 'h-12 w-full rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30';
const primary = 'h-12 w-full rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40';

function SignIn() {
  const router = useRouter();
  const host = useHost();
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [acct, setAcct] = useState<AccountOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach ClinicQ. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const goStaff = (me: Me) => router.replace(homeFor(me));
  const asPatient = () =>
    run(async () => {
      const { code: h } = await api.accountPatient(acct!.ticket);
      window.location.href = patientUrl(`/patient?h=${encodeURIComponent(h)}`, host);
    });

  return (
    <main className="min-h-screen bg-surface flex flex-col">
      <header className="border-b border-surface-container">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center">
          <BrandLogo />
        </div>
      </header>
      <div className="flex-1 w-full max-w-md mx-auto px-4 py-8 flex flex-col gap-5">
        {step === 'mobile' && (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api.accountStart(mobile); if (r.dev_code) setCode(r.dev_code); setStep('code'); }); }}>
            <div>
              <h1 className="font-headline-md text-headline-md">Sign in or sign up</h1>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">For patients, doctors and clinics. We&apos;ll send a code on WhatsApp.</p>
            </div>
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md">Mobile number</span>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" className={field} autoFocus />
            </label>
            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
            <button disabled={busy || mobile.replace(/\D/g, '').length < 10} className={primary}>{busy ? 'Sending…' : 'Send code on WhatsApp'}</button>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
              Staff with a username? <Link href="/login" className="text-primary">Sign in with password</Link>
            </p>
          </form>
        )}

        {step === 'code' && (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run(async () => { const a = await api.accountVerify(mobile, code); setAcct(a); setStep(a.logins.length ? 'choose' : 'who'); }); }}>
            <div>
              <h1 className="font-headline-md text-headline-md">Enter the code</h1>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">Sent on WhatsApp to {mobile}. <button type="button" className="text-primary" onClick={() => setStep('mobile')}>Change</button></p>
            </div>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits" className={field} autoFocus />
            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
            <button disabled={busy || code.length !== 6} className={primary}>{busy ? 'Checking…' : 'Continue'}</button>
          </form>
        )}

        {step === 'choose' && acct && (
          <div className="flex flex-col gap-3">
            <h1 className="font-headline-md text-headline-md">Continue as</h1>
            {acct.logins.map((l) => (
              <Choice key={l.user_id} icon="local_hospital" title={l.clinic_name} sub={`${l.name} · ${l.role === 'owner' ? 'clinic admin' : l.role}`} onClick={() => run(async () => goStaff(await api.accountStaff(acct.ticket, l.user_id)))} disabled={busy} />
            ))}
            <Choice icon="person" title="Patient" sub="Your tokens and past visits" onClick={asPatient} disabled={busy} />
            <button type="button" onClick={() => setStep('who')} className="font-label-md text-label-md text-primary self-start mt-2">Add another clinic or join one</button>
            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
          </div>
        )}

        {step === 'who' && acct && (
          <div className="flex flex-col gap-3">
            <h1 className="font-headline-md text-headline-md">What brings you to ClinicQ?</h1>
            {acct.pending.map((p, i) => (
              <p key={i} className="rounded-xl bg-surface-container-low p-3 font-body-md text-body-md">
                {p.kind === 'signup' ? `Your clinic ${p.clinic_name} is waiting for ClinicQ to check the documents.` : `Your request to join ${p.clinic_name} is with the clinic.`}
              </p>
            ))}
            <Choice icon="person" title="I'm a patient" sub="Find doctors, take tokens, see past visits" onClick={asPatient} disabled={busy} />
            <Choice icon="apartment" title="I own or run a clinic / hospital" sub="List your clinic free and manage it" onClick={() => setStep('signup')} disabled={busy} />
            <Choice icon="stethoscope" title="I'm a doctor at a clinic" sub="Ask your clinic to add you" onClick={() => setStep('join')} disabled={busy} />
            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
          </div>
        )}

        {step === 'signup' && acct && <SignupForm ticket={acct.ticket} onBack={() => setStep('who')} onDone={goStaff} />}
        {step === 'join' && acct && <JoinForm ticket={acct.ticket} onBack={() => setStep('who')} onDone={() => setStep('joined')} />}
        {step === 'joined' && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col items-center text-center gap-3">
            <Icon name="task_alt" className="text-[40px] text-primary" />
            <h1 className="font-headline-sm text-headline-sm">Request sent</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">When the clinic accepts, sign in here again with your mobile — your doctor login will be ready.</p>
            <Link href="/" className="font-label-md text-label-md text-primary">Back to ClinicQ</Link>
          </div>
        )}
      </div>
    </main>
  );
}

function Choice({ icon, title, sub, onClick, disabled }: { icon: string; title: string; sub: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="text-left rounded-2xl bg-surface-container-lowest shadow-sm px-4 py-4 flex items-center gap-3 hover:shadow-md disabled:opacity-50">
      <span className="w-11 h-11 rounded-xl bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0"><Icon name={icon} className="text-[22px]" /></span>
      <span className="flex-1 min-w-0">
        <span className="block font-label-lg text-label-lg truncate">{title}</span>
        <span className="block font-body-sm text-body-sm text-on-surface-variant">{sub}</span>
      </span>
      <Icon name="chevron_right" className="text-on-surface-variant" />
    </button>
  );
}

/** Live search of listed clinics — used to avoid duplicates (signup) and to pick the clinic (join). */
function useClinicMatches(q: string) {
  const [rows, setRows] = useState<DirectoryClinicSummary[]>([]);
  useEffect(() => {
    if (q.trim().length < 3) return setRows([]);
    const t = setTimeout(() => api.directoryClinicsSearch({ q: q.trim(), limit: '5', any: '1' }).then(setRows).catch(() => setRows([])), 300);
    return () => clearTimeout(t);
  }, [q]);
  return rows;
}

function SignupForm({ ticket, onBack, onDone }: { ticket: string; onBack: () => void; onDone: (me: Me) => void }) {
  const [f, setF] = useState({ clinic_name: '', city: '', address: '', phone: '', you_are: 'doctor', your_name: '', specialty: '', qualification: '' });
  const [files, setFiles] = useState<Record<string, File | null>>({ id_proof: null, registration: null, clinic_proof: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = useClinicMatches(f.clinic_name);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const ready = f.clinic_name.trim() && f.city.trim() && f.address.trim() && f.your_name.trim() && files.id_proof && (files.registration || files.clinic_proof);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const form = new FormData();
          form.set('ticket', ticket);
          Object.entries(f).forEach(([k, v]) => v && form.set(k, v));
          for (const [k, file] of Object.entries(files)) if (file) form.append(k, await shrinkImage(file));
          onDone(await api.accountSignupClinic(form));
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="font-headline-md text-headline-md">List your clinic — free</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">You can manage it right away. It appears in search with a Verified badge once ClinicQ checks your documents.</p>
      </div>
      <input value={f.clinic_name} onChange={set('clinic_name')} placeholder="Clinic or hospital name" className={field} />
      {matches.length > 0 && (
        <div className="rounded-xl bg-surface-container-low p-3 flex flex-col gap-2">
          <p className="font-label-md text-label-md">Already on ClinicQ? Claim it instead:</p>
          {matches.map((m) => (
            <Link key={m.slug} href={`/claim/${m.subdomain}`} className="font-body-md text-body-md text-primary flex items-center gap-1">
              <Icon name="arrow_forward" className="text-[16px]" /> {m.clinic_name}{m.city ? `, ${m.city}` : ''}
            </Link>
          ))}
        </div>
      )}
      <input value={f.address} onChange={set('address')} placeholder="Clinic address" className={field} />
      <div className="grid grid-cols-2 gap-3">
        <input value={f.city} onChange={set('city')} placeholder="City" className={field} />
        <input value={f.phone} onChange={set('phone')} placeholder="Clinic phone (optional)" inputMode="tel" className={field} />
      </div>
      <select value={f.you_are} onChange={set('you_are')} className={field}>
        <option value="doctor">I&apos;m the doctor here</option>
        <option value="manager">I manage the clinic (not a doctor)</option>
      </select>
      <input value={f.your_name} onChange={set('your_name')} placeholder={f.you_are === 'doctor' ? 'Your name, e.g. Dr. Meera Sharma' : 'Your name'} className={field} />
      {f.you_are === 'doctor' && (
        <div className="grid grid-cols-2 gap-3">
          <input value={f.specialty} onChange={set('specialty')} placeholder="Specialty" className={field} />
          <input value={f.qualification} onChange={set('qualification')} placeholder="Qualification" className={field} />
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest shadow-sm p-4">
        <p className="font-label-lg text-label-lg">Documents <span className="font-body-sm text-body-sm text-on-surface-variant">(only ClinicQ sees them)</span></p>
        {[
          ['id_proof', 'Your photo ID *', 'Aadhaar, PAN, driving licence'],
          ['registration', 'Registration certificate', 'Medical council or clinic registration'],
          ['clinic_proof', 'Clinic proof', 'Signboard photo, letterhead, GST or electricity bill'],
        ].map(([k, label, hint]) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">{label}</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">{hint}</span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFiles((x) => ({ ...x, [k]: e.target.files?.[0] ?? null }))} className="font-body-sm text-body-sm" />
          </label>
        ))}
        <p className="font-body-sm text-body-sm text-on-surface-variant">Photo ID plus a registration certificate or a clinic proof.</p>
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <button disabled={busy || !ready} className={primary}>{busy ? 'Setting up…' : 'Add my clinic'}</button>
      <button type="button" onClick={onBack} className="font-label-md text-label-md text-primary">Back</button>
    </form>
  );
}

function JoinForm({ ticket, onBack, onDone }: { ticket: string; onBack: () => void; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [clinic, setClinic] = useState<DirectoryClinicSummary | null>(null);
  const [f, setF] = useState({ your_name: '', specialty: '', qualification: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = useClinicMatches(clinic ? '' : q);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!clinic?.subdomain) return;
        setBusy(true);
        setError(null);
        try {
          await api.accountJoin({ ticket, clinic_code: clinic.subdomain, ...f });
          onDone();
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="font-headline-md text-headline-md">Join your clinic</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Find your clinic; its admin will add you. If your clinic isn&apos;t listed, go back and choose &ldquo;I own or run a clinic&rdquo;.</p>
      </div>
      {clinic ? (
        <div className="rounded-xl bg-surface-container-low px-3 py-3 flex items-center gap-3">
          <Icon name="local_hospital" className="text-primary" />
          <span className="flex-1 font-label-lg text-label-lg">{clinic.clinic_name}</span>
          <button type="button" onClick={() => setClinic(null)} className="font-label-md text-label-md text-primary">Change</button>
        </div>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your clinic by name" className={field} />
          {matches.map((m) => (
            <button key={m.slug} type="button" onClick={() => setClinic(m)} className="text-left rounded-xl bg-surface-container-lowest shadow-sm px-3 py-2.5 font-body-md text-body-md">
              {m.clinic_name}{m.city ? `, ${m.city}` : ''}
            </button>
          ))}
        </>
      )}
      <input value={f.your_name} onChange={(e) => setF({ ...f, your_name: e.target.value })} placeholder="Your name, e.g. Dr. Meera Sharma" className={field} />
      <div className="grid grid-cols-2 gap-3">
        <input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="Specialty" className={field} />
        <input value={f.qualification} onChange={(e) => setF({ ...f, qualification: e.target.value })} placeholder="Qualification" className={field} />
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <button disabled={busy || !clinic || !f.your_name.trim()} className={primary}>{busy ? 'Sending…' : 'Ask to join'}</button>
      <button type="button" onClick={onBack} className="font-label-md text-label-md text-primary">Back</button>
    </form>
  );
}
