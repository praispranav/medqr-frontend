'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, shrinkImage } from '@/lib/api';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Icon } from '@/components/patient/ui';

// Decision 64 — "Is this your clinic?": the clinic/hospital (or one of its doctors) asks to claim the
// listing or to have it removed. Documents prove the connection; ClinicQ checks them by hand at
// Owner › Claims before anything changes. ID proofs are stored privately, never at a public link.

type Target = Awaited<ReturnType<typeof api.listingClaimTarget>>;
type DocKind = 'id_proof' | 'registration' | 'clinic_proof';

const DOCS: { kind: DocKind; label: string; hint: string; required: boolean }[] = [
  { kind: 'id_proof', label: 'Your photo ID', hint: 'Aadhaar, PAN, driving licence or passport', required: true },
  { kind: 'registration', label: 'Registration certificate', hint: 'Medical council registration, or the clinic / hospital registration', required: false },
  { kind: 'clinic_proof', label: 'Clinic proof', hint: 'Signboard photo with you, letterhead, GST certificate or electricity bill in the clinic’s name', required: false },
];

export function ClaimForm({ code, initialKind, initialDoctor }: { code: string; initialKind: 'claim' | 'remove'; initialDoctor?: string }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [kind, setKind] = useState(initialKind);
  const [doctorId, setDoctorId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('owner');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<Record<DocKind, File | null>>({ id_proof: null, registration: null, clinic_proof: null });
  const [agree, setAgree] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .listingClaimTarget(code)
      .then((t) => {
        setTarget(t);
        const d = initialDoctor && t.doctors.find((x) => x.id === initialDoctor);
        if (d) setDoctorId(d.id);
      })
      .catch(() => setNotFound(true));
  }, [code, initialDoctor]);

  const proofOk = !!files.id_proof && (!!files.registration || !!files.clinic_proof);
  const ready = name.trim() && /^[6-9]\d{9}$/.test(mobile.replace(/\D/g, '').slice(-10)) && proofOk && agree;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('kind', kind);
      if (kind === 'remove' && doctorId) form.set('doctor_id', doctorId);
      form.set('name', name);
      form.set('role', role);
      form.set('mobile', mobile);
      if (email) form.set('email', email);
      if (message) form.set('message', message);
      if (website) form.set('website', website);
      for (const d of DOCS) {
        const f = files[d.kind];
        if (f) form.append(d.kind, await shrinkImage(f));
      }
      await api.submitListingClaim(code, form);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30';
  const toggle = (v: 'claim' | 'remove', label: string) => (
    <button type="button" onClick={() => setKind(v)} aria-pressed={kind === v} className={`flex-1 h-11 rounded-lg font-label-lg text-label-lg ${kind === v ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>
      {label}
    </button>
  );

  return (
    <main className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-surface-container">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <BrandLogo />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        {notFound && <p className="font-body-md text-body-md text-on-surface-variant">We couldn’t find this clinic. Please check the link, or <Link href="/contact" className="text-primary">contact us</Link>.</p>}
        {!target && !notFound && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}

        {target && done && (
          <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 flex flex-col items-center text-center gap-3">
            <Icon name="task_alt" className="text-[40px] text-primary" />
            <h1 className="font-headline-sm text-headline-sm">Request received</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
              We’ll check your documents and call or WhatsApp you on {mobile} — usually within 2 working days. Nothing on the listing changes until then.
            </p>
            <Link href="/" className="mt-2 h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg inline-flex items-center">Back to ClinicQ</Link>
          </section>
        )}

        {target && !done && (
          <form onSubmit={submit} className="flex flex-col gap-6">
            <div>
              <h1 className="font-headline-md text-headline-md">{target.clinic_name}</h1>
              {target.city && <p className="font-body-md text-body-md text-on-surface-variant">{target.city}</p>}
            </div>

            <div className="flex gap-1 bg-surface-container-low rounded-xl p-1">
              {toggle('claim', 'Claim this clinic')}
              {toggle('remove', 'Remove from listing')}
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant -mt-3">
              {kind === 'claim'
                ? target.claimed
                  ? 'This clinic has already been claimed. If that wasn’t you, send this request and we’ll look into it.'
                  : 'Manage this page yourself: correct the details, add your doctors and hours, and let patients take tokens online.'
                : 'We’ll take this clinic (or one doctor) off ClinicQ’s public directory once we’ve checked you’re connected to it.'}
            </p>

            {kind === 'remove' && target.doctors.length > 0 && (
              <label className="flex flex-col gap-1.5 font-label-md text-label-md">
                What should be removed?
                <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={field}>
                  <option value="">The whole clinic</option>
                  {target.doctors.map((d) => (
                    <option key={d.id} value={d.id}>Only {d.name}</option>
                  ))}
                </select>
              </label>
            )}

            <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex flex-col gap-4">
              <h2 className="font-label-lg text-label-lg">About you</h2>
              <label className="flex flex-col gap-1.5 font-label-md text-label-md">
                Your full name
                <input value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" />
              </label>
              <label className="flex flex-col gap-1.5 font-label-md text-label-md">
                You are the clinic’s
                <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
                  <option value="owner">Owner</option>
                  <option value="doctor">Doctor</option>
                  <option value="manager">Manager / staff</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 font-label-md text-label-md">
                  Mobile (WhatsApp)
                  <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="10-digit number" className={field} />
                </label>
                <label className="flex flex-col gap-1.5 font-label-md text-label-md">
                  Email (optional)
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className={field} />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 font-label-md text-label-md">
                Anything we should know? (optional)
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="rounded-xl bg-surface-container-low p-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            </section>

            <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex flex-col gap-4">
              <div>
                <h2 className="font-label-lg text-label-lg">Documents</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Your photo ID, plus a registration certificate or a clinic proof. Photos or PDFs. Only the ClinicQ team sees them.</p>
              </div>
              {DOCS.map((d) => (
                <label key={d.kind} className="flex flex-col gap-1.5">
                  <span className="font-label-md text-label-md">
                    {d.label} {d.required ? <span className="text-error">*</span> : <span className="text-on-surface-variant font-body-sm text-body-sm">(one of these two)</span>}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{d.hint}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFiles((f) => ({ ...f, [d.kind]: e.target.files?.[0] ?? null }))}
                    className="font-body-sm text-body-sm file:mr-3 file:h-10 file:px-4 file:rounded-xl file:border-0 file:bg-surface-container file:text-primary file:font-label-md"
                  />
                </label>
              ))}
            </section>

            <label className="flex items-start gap-3 font-body-md text-body-md">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 w-4 h-4" />
              <span>I confirm I’m authorised to act for this clinic and the documents are genuine.</span>
            </label>

            {error && <p className="font-body-md text-body-md text-error">{error}</p>}
            <button disabled={!ready || busy} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-50">
              {busy ? 'Sending…' : kind === 'claim' ? 'Send claim request' : 'Send removal request'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
