'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError, fileUrl, type DoctorToday, type Patient, type PaymentEvent, type PaymentQrView, type Tenant, type Visit, type VisitAttachment } from '@/lib/api';
import { PaymentLog } from '@/components/payments/PaymentLog';
import { UpiQrCard } from '@/components/payments/UpiQrCard';
import { Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { inr, VitalsChips } from '@/components/staff/bits';

// Screen #6 — Doctor Patient Timeline & Consultation (simplified per Decision 4). Ported from
// stitch_medqr_clinic_suite_ui_design/doctor_patient_timeline_consultation_simplified/code.html.
// - One free-text note, no structured Rx/ICD form (Decision 4)
// - Attachments from doctor, reception or patient, always labelled with who added them (Decision 4)
// - Vitals strip only when something was recorded (Decision 5)
// - Fee + "Mark as paid" only when payment_mode === 'pay_after_consultation' (Decision 8)

export default function ConsultationPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/consultation">
      {({ tenant, doctor }) => <Consultation tenant={tenant} doctor={doctor!} />}
    </StaffShell>
  );
}

const UPLOADER_LABEL: Record<VisitAttachment['uploaded_by'], string> = {
  doctor: 'Added by you',
  reception: 'Added by reception',
  patient: 'Added by patient',
};

function Consultation({ tenant, doctor }: { tenant: Tenant; doctor: DoctorToday }) {
  const { visitId } = useParams<{ visitId: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<Visit[]>([]);
  const [openPast, setOpenPast] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { visit: v, patient: p } = await api.getVisit(visitId);
        setVisit(v);
        setPatient(p);
        setNote(v.note ?? '');
        if (p) setHistory((await api.getPatientHistory(p.id, tenant.id)).filter((h) => h.id !== v.id));
      } catch {
        setNotFound(true);
      }
    })();
  }, [visitId, tenant.id]);

  if (notFound)
    return (
      <div className="max-w-md mx-auto text-center py-16 flex flex-col gap-3">
        <p className="font-headline-md text-headline-md">Visit not found</p>
        <Link href="/doctor/dashboard" className="text-primary font-label-lg text-label-lg">
          Back to queue
        </Link>
      </div>
    );
  if (!visit) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;

  const dirty = note !== (visit.note ?? '');

  const saveNote = async () => {
    setSaved('saving');
    try {
      setVisit(await api.saveNote(visit.id, note.trim() ? note : null));
      setSaved('saved');
      return true;
    } catch {
      setSaved('error');
      return false;
    }
  };

  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      let latest = visit;
      for (const file of Array.from(files)) {
        const up = await api.uploadFile(file);
        latest = await api.addAttachment(visit.id, {
          url: up.url,
          name: up.name,
          uploaded_by: 'doctor',
          uploaded_at: new Date().toISOString(),
        });
      }
      setVisit(latest);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const visitDate = new Date(visit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-5 max-w-[1300px]">
        {/* ---------- Left: patient + timeline ---------- */}
        <div className="flex flex-col gap-4">
          <Link href="/doctor/dashboard" className="flex items-center gap-1.5 text-primary font-label-md text-label-md self-start">
            <Icon name="arrow_back" className="text-[18px]" /> Queue
          </Link>
          <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
            <h1 className="font-headline-md text-headline-md text-on-surface">{patient?.name ?? 'Patient'}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {[patient?.age ? `${patient.age} yrs` : null, patient?.gender, patient ? `+91 ${patient.mobile_number}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {!!patient?.allergies?.length && (
              <span className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-md text-label-md">
                <Icon name="warning" className="text-[16px]" />
                {patient.allergies.join(', ')}
              </span>
            )}
          </section>

          <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                <Icon name="history" className="text-[18px]" /> Past visits
              </h2>
              <span className="font-body-sm text-body-sm text-outline">{history.length} records</span>
            </div>
            {history.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">First visit to this clinic.</p>}
            <div className="flex flex-col divide-y divide-surface-container">
              {history.map((h) => {
                const open = openPast === h.id;
                return (
                  <button key={h.id} onClick={() => setOpenPast(open ? null : h.id)} className="text-left py-3 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-label-lg text-label-lg text-on-surface">
                        {new Date(h.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {h.chief_complaint ? ` · ${h.chief_complaint}` : ''}
                      </p>
                      {h.attachments.length > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant shrink-0">
                          <Icon name="attach_file" className="text-[14px]" />
                          {h.attachments.length}
                        </span>
                      )}
                    </div>
                    <p className={`font-body-sm text-body-sm text-on-surface-variant whitespace-pre-wrap ${open ? '' : 'line-clamp-2'}`}>
                      {h.note || 'No note written'}
                    </p>
                    {open && h.attachments.length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-1">
                        {h.attachments.map((a) => (
                          <a
                            key={a.url}
                            href={fileUrl(a.url)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-label-sm text-label-sm text-primary underline"
                          >
                            {a.name ?? 'Attachment'}
                          </a>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* ---------- Right: today's visit ---------- */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex items-center gap-3 flex-wrap lg:mt-7">
            <h2 className="font-headline-md text-headline-md text-on-surface">Today&apos;s visit · {visitDate}</h2>
            <span className="px-3 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-md text-label-md">
              Token #{visit.token_number}
            </span>
          </div>

          <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            {visit.vitals && Object.keys(visit.vitals).length > 0 && (
              <div className="bg-surface-container-low rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 font-label-md text-label-md text-primary">
                  <Icon name="monitor_heart" className="text-[18px]" /> Vitals
                </span>
                <VitalsChips vitals={visit.vitals} />
              </div>
            )}

            {visit.chief_complaint && (
              <p className="font-body-md text-body-md">
                <span className="text-on-surface-variant">Patient says: </span>
                <span className="text-on-surface font-semibold">{visit.chief_complaint}</span>
              </p>
            )}

            {visit.intake_answers && Object.keys(visit.intake_answers).length > 0 && (
              <div className="flex flex-col gap-1 bg-surface-container-lowest p-3 rounded-lg border border-surface-container">
                <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                  <Icon name="assignment" className="text-[14px]" /> Additional Details
                </span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {Object.entries(visit.intake_answers).map(([key, val]) => {
                    const schema = doctor.intake_schema?.find((s: any) => s.id === key);
                    const label = schema?.label || key;
                    const valueStr = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : Array.isArray(val) ? val.join(', ') : val;
                    return (
                      <p key={key} className="font-body-sm text-body-sm">
                        <span className="text-on-surface-variant">{label}: </span>
                        <span className="text-on-surface font-semibold">{String(valueStr)}</span>
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setSaved('idle');
              }}
              rows={7}
              placeholder="Write anything — diagnosis, advice, medicines. Or just attach a photo of your prescription pad."
              className="w-full p-4 rounded-xl bg-surface-container-low font-body-lg text-body-lg text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />

            <div className="flex items-center gap-3 flex-wrap">
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => attach(e.target.files)}
              />
              <button
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className="h-12 px-5 rounded-xl bg-primary-container text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-60"
              >
                <Icon name={uploading ? 'progress_activity' : 'photo_camera'} className={`text-[20px] ${uploading ? 'animate-spin' : ''}`} />
                {uploading ? 'Uploading…' : 'Attach photo / report'}
              </button>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Handwritten slips, Rx pad photos, reports (JPG/PNG/PDF, 15 MB)</span>
              {uploadError && <span className="font-body-sm text-body-sm text-error">{uploadError}</span>}
            </div>

            {visit.attachments.length > 0 && (
              <div>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
                  Attached documents ({visit.attachments.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {visit.attachments.map((a) => (
                    <a
                      key={a.url}
                      href={fileUrl(a.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-surface-container p-2 flex flex-col gap-2 hover:shadow-sm"
                    >
                      <div className="aspect-[4/3] rounded-lg bg-surface-container-low overflow-hidden flex items-center justify-center">
                        {/\.pdf$/i.test(a.url) ? (
                          <Icon name="picture_as_pdf" className="text-[40px] text-error" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fileUrl(a.url)} alt={a.name ?? 'Attachment'} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="px-1 min-w-0">
                        <p className="font-label-md text-label-md text-on-surface truncate">{a.name ?? 'Attachment'}</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          {UPLOADER_LABEL[a.uploaded_by]} ·{' '}
                          {new Date(a.uploaded_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>

          <PaymentSection
            visit={visit}
            tenant={tenant}
            onReload={async () => setVisit((await api.getVisit(visit.id)).visit)}
          />

          <div className="flex items-center justify-end gap-3 flex-wrap">
            {saved === 'saved' && !dirty && <span className="font-label-md text-label-md text-tertiary">Saved ✓</span>}
            {saved === 'error' && <span className="font-label-md text-label-md text-error">Couldn&apos;t save — try again</span>}
            {tenant.entitlements?.smart_print && (
              <button
                onClick={() => window.print()}
                className="h-12 px-5 rounded-xl border border-outline-variant bg-surface-container-lowest font-label-lg text-label-lg flex items-center gap-2"
              >
                <Icon name="print" className="text-[20px]" /> Print
              </button>
            )}
            <button
              disabled={saved === 'saving'}
              onClick={async () => {
                if (await saveNote()) router.push('/doctor/dashboard');
              }}
              className="h-12 px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 shadow-md disabled:opacity-60"
            >
              <Icon name="check" className="text-[20px]" /> Save visit
            </button>
          </div>
        </div>
      </div>

      {/* Print-only visit summary */}
      <div className="hidden print:block text-black p-8 font-body-md">
        <div style={{ borderBottom: '2px solid #0f766e', paddingBottom: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 22, fontWeight: 700 }}>{doctor.name}</p>
          <p style={{ fontSize: 13 }}>
            {[doctor.qualification, doctor.specialty].filter(Boolean).join(' · ')} — {tenant.display_name ?? tenant.subdomain}
          </p>
        </div>
        <p style={{ fontSize: 14 }}>
          <strong>{patient?.name}</strong> {patient?.age ? `· ${patient.age} yrs` : ''} {patient?.gender ? `· ${patient.gender}` : ''} ·{' '}
          {visitDate}
        </p>
        {visit.chief_complaint && <p style={{ fontSize: 13, marginTop: 6 }}>Complaint: {visit.chief_complaint}</p>}
        <div style={{ marginTop: 6 }}>
          <VitalsChips vitals={visit.vitals} />
        </div>
        <p style={{ fontSize: 15, marginTop: 20, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{note}</p>
      </div>
    </>
  );
}

/**
 * Payment for this visit (Decisions 8–10). The doctor always sees paid/unpaid, the patient's choice and
 * the full payment log. In pay-after-consultation clinics the doctor also sets the fee and can take the
 * payment here (cash, UPI at counter, or a fresh UPI QR the patient scans).
 */
function PaymentSection({ visit, tenant, onReload }: { visit: Visit; tenant: Tenant; onReload: () => Promise<void> }) {
  const collectHere = tenant.queue_settings.payment_mode === 'pay_after_consultation';
  const fee = Number(visit.consultation_fee_inr ?? tenant.queue_settings.default_consultation_fee_inr);
  const [feeInput, setFeeInput] = useState(String(fee));
  const [qr, setQr] = useState<PaymentQrView | null>(null);
  const [online, setOnline] = useState(false);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.paymentConfig().then((c) => setOnline(c.online_available)).catch(() => setOnline(false));
  }, []);
  useEffect(() => {
    api.visitPaymentEvents(visit.id).then(setEvents).catch(() => setEvents([]));
  }, [visit.id, visit.is_paid, visit.consultation_fee_inr, visit.payment_choice]);
  useEffect(() => setFeeInput(String(fee)), [fee]);
  // While a QR is on screen, check every few seconds whether the patient has paid.
  useEffect(() => {
    if (!qr || visit.is_paid) return;
    const id = setInterval(onReload, 4000);
    return () => clearInterval(id);
  }, [qr, visit.is_paid, onReload]);
  useEffect(() => {
    if (visit.is_paid) setQr(null);
  }, [visit.is_paid]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onReload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const methodLabel = { cash: 'Cash', upi_counter: 'UPI at counter', upi_online: 'Online (UPI QR)' } as const;
  const newFee = Number(feeInput) || 0;

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-label-lg text-label-lg text-on-surface flex items-center gap-2">
          <Icon name="currency_rupee" className="text-primary text-[20px]" /> Consultation fee
        </p>
        {visit.is_paid ? (
          <span className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-tertiary-fixed/60 text-on-tertiary-fixed-variant font-label-md text-label-md">
              Paid {inr(visit.consultation_fee_inr)} · {visit.payment_method ? methodLabel[visit.payment_method] : ''}
            </span>
            <button
              disabled={busy}
              onClick={() => {
                const reason = window.prompt('Why undo this payment? (kept in the payment log)');
                if (reason?.trim()) run(() => api.unmarkPaid(visit.id, reason));
              }}
              className="font-label-md text-label-md text-on-surface-variant underline underline-offset-4"
            >
              Undo
            </button>
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md">
            {inr(fee)} not paid
            {visit.payment_choice ? ` · patient chose ${visit.payment_choice === 'online' ? 'online' : 'cash'}` : ''}
          </span>
        )}
      </div>

      {!visit.is_paid && collectHere && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-surface-container-low rounded-xl px-3 h-12 w-32">
              <span className="font-label-lg text-label-lg text-on-surface-variant">₹</span>
              <input
                inputMode="numeric"
                aria-label="Fee for this visit"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-transparent px-1 font-headline-sm text-headline-sm focus:outline-none"
              />
            </div>
            {newFee !== fee && (
              <button disabled={busy} onClick={() => run(() => api.setFee(visit.id, newFee))} className="h-12 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md">
                Update fee
              </button>
            )}
            <button disabled={busy || newFee !== fee} onClick={() => run(() => api.markPaid(visit.id, 'cash', fee))} className="h-12 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md disabled:opacity-50">
              {busy ? 'Processing...' : 'Paid · Cash'}
            </button>
            <button disabled={busy || newFee !== fee} onClick={() => run(() => api.markPaid(visit.id, 'upi_counter', fee))} className="h-12 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md disabled:opacity-50">
              {busy ? 'Processing...' : 'Paid · UPI at counter'}
            </button>
            {online && !qr && (
              <button
                disabled={busy || newFee !== fee}
                onClick={() => run(async () => setQr(await api.staffQr(visit.id)))}
                className="h-12 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <Icon name="qr_code_2" className="text-[18px]" /> {busy ? 'Loading...' : 'Show UPI QR'}
              </button>
            )}
          </div>
          {qr && <UpiQrCard qr={qr} onChanged={onReload} />}
        </div>
      )}
      {!visit.is_paid && !collectHere && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">Reception collects the fee at the counter.</p>
      )}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

      <button onClick={() => setShowLog((v) => !v)} className="self-start flex items-center gap-1 font-label-md text-label-md text-primary">
        <Icon name={showLog ? 'expand_less' : 'history'} className="text-[18px]" /> {showLog ? 'Hide payment history' : `Payment history (${events.length})`}
      </button>
      {showLog && <PaymentLog events={events} />}
    </section>
  );
}
