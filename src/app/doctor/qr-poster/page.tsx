'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type DoctorToday, type QrCodeView, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { patientBaseUrl, PosterCard, posterContentFor, POSTER_FORMATS, type PosterContent } from '@/components/qr/QrPoster';

// Doctor portal — QR standees. Ported from
// stitch_medqr_clinic_suite_ui_design/reception_counter_qr_standee_print_suite/code.html.
// 1) "My QR codes": standalone standees (handed out at onboarding) linked to this doctor — by admin,
//    or by the doctor scanning one while logged in / typing its printed code here.
// 2) The clinic-wide QR (/patient/<clinic>), where patients pick the doctor on screen #1A.
// Every poster downloads as a PDF at the exact paper size or a ~300 dpi PNG.

export default function QrPosterPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/qr-poster">
      {({ tenant, doctor, doctors }) => <QrSuite tenant={tenant} doctor={doctor!} doctorCount={doctors.length} />}
    </StaffShell>
  );
}

function QrSuite({ tenant, doctor, doctorCount }: { tenant: Tenant; doctor: DoctorToday; doctorCount: number }) {
  const [mine, setMine] = useState<QrCodeView[] | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [base, setBase] = useState('');

  const load = useCallback(async () => {
    const list = await api.myQrCodes();
    setMine(list);
    setOpenId((cur) => cur ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    setBase(patientBaseUrl());
    load().catch(() => setMine([]));
  }, [load]);

  const link = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const q = await api.claimQr(code);
      setCode('');
      setOpenId(q.id);
      await load();
      setMsg({ kind: 'ok', text: `MQ-${q.code} is now yours — patients who scan it check in with you.` });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : "Couldn't link that code." });
    } finally {
      setBusy(false);
    }
  };

  const clinicName = tenant.display_name ?? tenant.subdomain;
  const clinicUrl = base ? `${base}/patient/${tenant.subdomain}` : '';
  const clinicPoster: PosterContent = {
    url: clinicUrl,
    title: doctorCount === 1 ? doctor.name : clinicName,
    subtitle: doctorCount === 1 ? [doctor.specialty, clinicName].filter(Boolean).join(' · ') : 'Live OPD digital queue',
    footer: `${tenant.subdomain}.medqr.in`,
  };
  const isLocal = /localhost|127\.0\.0\.1/.test(base);
  const open = mine?.find((q) => q.id === openId) ?? null;

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">QR standees</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Download as PDF (prints at exact size — choose “Actual size”, not “Fit to page”) or PNG.
          </p>
        </div>
        {isLocal && (
          <p className="flex items-start gap-2 bg-secondary-fixed/30 rounded-xl p-3 font-body-sm text-body-sm text-on-secondary-fixed-variant max-w-md">
            <Icon name="warning" className="text-[18px] mt-0.5" />
            QRs made here point at this computer and only work on the same Wi-Fi. Set NEXT_PUBLIC_PATIENT_BASE_URL before
            printing real standees.
          </p>
        )}
      </div>

      {/* ---- My QR codes ---- */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-headline-sm text-headline-sm">My QR codes</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Patients who scan these go straight to your check-in. Got a new standee? Scan it with your phone while logged in,
              or type its code.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) link();
            }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center bg-surface-container-low rounded-xl px-3 h-11">
              <span className="font-label-lg text-label-lg text-on-surface-variant">MQ-</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/^MQ-?/, '').replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="K7P3Q9"
                aria-label="QR code printed on the standee"
                className="w-24 bg-transparent font-label-lg text-label-lg tracking-wider focus:outline-none"
              />
            </div>
            <button disabled={busy || code.length < 6} className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-40">
              <Icon name="link" className="text-[18px]" /> {busy ? 'Linking…' : 'Link to me'}
            </button>
          </form>
        </div>
        {msg && <p className={`font-body-md text-body-md ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}

        {mine === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        {mine?.length === 0 && (
          <p className="bg-surface-container-low rounded-xl p-4 font-body-md text-body-md text-on-surface-variant">
            No standees linked to you yet. The clinic QR below works in the meantime.
          </p>
        )}
        {mine && mine.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {mine.map((q) => (
              <button
                key={q.id}
                onClick={() => setOpenId(q.id)}
                className={`px-3 py-1.5 rounded-full font-label-md text-label-md tracking-wider ${openId === q.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
              >
                MQ-{q.code}
              </button>
            ))}
          </div>
        )}
        {open && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {POSTER_FORMATS.map((f) => (
              <PosterCard key={f.key} kind={f.key} content={posterContentFor(open)} fileBase={`medqr-MQ-${open.code}`} />
            ))}
          </div>
        )}
      </section>

      {/* ---- Clinic QR ---- */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm">Clinic QR</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant break-all">
            {doctorCount > 1 ? 'One QR for the whole clinic — patients pick their doctor after scanning. ' : ''}
            {clinicUrl}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {POSTER_FORMATS.map((f) => (
            <PosterCard key={f.key} kind={f.key} content={clinicPoster} fileBase={`medqr-${tenant.subdomain}`} />
          ))}
        </div>
      </section>
    </div>
  );
}
