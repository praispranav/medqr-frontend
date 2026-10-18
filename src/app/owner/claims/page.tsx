'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminApi, ListingClaimView } from '@/lib/adminApi';
import { AdminShell } from '@/components/admin/AdminShell';
import { Icon } from '@/components/patient/ui';

// Decision 64 — super admin: check the documents behind each claim / removal request, then approve or
// reject. Approving a claim marks the clinic as claimed (create its login from the clinic page);
// approving a removal takes the clinic, or that one doctor, out of the public directory.

const DOC_LABEL = { id_proof: 'Photo ID', registration: 'Registration', clinic_proof: 'Clinic proof' } as const;

export default function ClaimsPage() {
  return <AdminShell active="/owner/claims">{(api) => <Claims api={api} />}</AdminShell>;
}

function Claims({ api }: { api: AdminApi }) {
  const [status, setStatus] = useState('new');
  const [rows, setRows] = useState<ListingClaimView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logins, setLogins] = useState<Record<string, { username: string; setup_link: string; whatsapp: string; mobile: string; name: string }>>({});

  useEffect(() => {
    setRows(null);
    api.claims(status).then(setRows).catch((e: Error) => setError(e.message));
  }, [api, status]);

  const decide = async (c: ListingClaimView, approve: boolean) => {
    const what = c.kind === 'claim' ? `mark ${c.clinic_name} as claimed by ${c.name}` : `remove ${c.doctor_name ?? c.clinic_name} from the public directory`;
    if (!window.confirm(approve ? `Approve — ${what}?` : `Reject this request from ${c.name}?`)) return;
    try {
      const saved = await api.decideClaim(c.id, approve);
      // Decision 67: an approved claim gets a clinic-admin login; show it so the link can be shared by hand too.
      if (saved.login) setLogins((l) => ({ ...l, [c.id]: { ...saved.login!, mobile: c.mobile, name: c.name } }));
      setRows((r) => (status === 'new' && !saved.login ? (r ?? []).filter((x) => x.id !== c.id) : (r ?? []).map((x) => (x.id === c.id ? { ...x, ...saved, documents: x.documents } : x))));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-md text-headline-md">Claims &amp; removals</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Clinics asking to manage their listing, or to be taken off it. Check the documents before approving.</p>
      </div>
      <div className="flex gap-1 bg-surface-container-low rounded-xl p-1 self-start">
        {(['new', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`h-9 px-4 rounded-lg font-label-md text-label-md capitalize ${status === s ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>
            {s === 'new' ? 'To review' : s}
          </button>
        ))}
      </div>
      {error && <p className="font-body-md text-body-md text-error">{error}</p>}
      {rows === null && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {rows?.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">Nothing here.</p>}
      {rows?.map((c) => (
        <article key={c.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${c.kind === 'claim' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-error-container text-on-error-container'}`}>
              {c.kind === 'claim' ? 'Claim' : 'Remove'}
            </span>
            <Link href={`/owner/clinics/${c.tenant_id}`} className="font-label-lg text-label-lg text-primary">{c.clinic_name ?? c.clinic_code}</Link>
            {c.doctor_name && <span className="font-body-md text-body-md text-on-surface-variant">· only {c.doctor_name}</span>}
            {!c.clinic_listed && <span className="font-body-sm text-body-sm text-on-surface-variant">(not listed)</span>}
            <span className="ml-auto font-body-sm text-body-sm text-on-surface-variant">{new Date(c.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
          <p className="font-body-md text-body-md">
            <strong>{c.name}</strong> · {c.role} · <a href={`tel:${c.mobile}`} className="text-primary">{c.mobile}</a>
            {' · '}<a href={`https://wa.me/91${c.mobile}`} target="_blank" rel="noreferrer" className="text-primary">WhatsApp</a>
            {c.email && <> · <a href={`mailto:${c.email}`} className="text-primary">{c.email}</a></>}
          </p>
          {c.message && <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-wrap">{c.message}</p>}
          <div className="flex flex-wrap gap-2">
            {c.documents.map((d) => (
              <a key={d.index} href={api.claimDocumentUrl(c.id, d.index)} target="_blank" rel="noreferrer" className="h-10 px-3 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md inline-flex items-center gap-2">
                <Icon name={d.mimetype === 'application/pdf' ? 'picture_as_pdf' : 'image'} className="text-[18px]" /> {DOC_LABEL[d.kind]}
              </a>
            ))}
          </div>
          {logins[c.id] && (
            <div className="rounded-xl bg-primary-fixed/30 p-3 flex flex-col gap-2 font-body-md text-body-md">
              <p>
                Clinic-admin login created: <strong>{logins[c.id].username}</strong> (or their mobile {logins[c.id].mobile}).{' '}
                {logins[c.id].whatsapp === 'sent' ? 'Sign-in link sent on WhatsApp.' : 'WhatsApp not sent — share the link below.'}
              </p>
              <a
                href={`https://wa.me/91${logins[c.id].mobile}?text=${encodeURIComponent(`Hello ${logins[c.id].name}, your request to manage your clinic on ClinicQ is approved. Set your password and sign in here: ${logins[c.id].setup_link}`)}`}
                target="_blank"
                rel="noreferrer"
                className="self-start h-10 px-4 rounded-xl bg-[#25D366] text-white font-label-md text-label-md inline-flex items-center"
              >
                Share sign-in link on WhatsApp
              </a>
            </div>
          )}
          {c.status === 'new' ? (
            <div className="flex gap-2">
              <button onClick={() => decide(c, true)} className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md">Approve</button>
              <button onClick={() => decide(c, false)} className="h-10 px-4 rounded-xl bg-surface-container text-error font-label-md text-label-md">Reject</button>
            </div>
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {c.status === 'approved' ? 'Approved' : 'Rejected'}{c.decided_at ? ` on ${new Date(c.decided_at).toLocaleDateString('en-IN')}` : ''}{c.admin_note ? ` — ${c.admin_note}` : ''}
              {c.status === 'approved' && c.kind === 'claim' && <> · <Link href={`/owner/clinics/${c.tenant_id}`} className="text-primary">open clinic</Link></>}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
