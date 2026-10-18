'use client';

import { useCallback, useEffect, useState } from 'react';
import { api as staffApi, ApiError, type QrCodeView } from '@/lib/api';

/** Just what this needs to pick a doctor — satisfied by both DoctorToday (staff) and AdminDoctor (owner/referrer). */
export interface QrStandeeDoctor {
  id: string;
  name: string;
  specialty: string | null;
}
import { Icon } from '@/components/patient/ui';
import { PosterCard, posterContentFor, POSTER_FORMATS } from '@/components/qr/QrPoster';

// Whole-clinic (default; scan opens doctor selection) or one-doctor (scan goes straight to their
// check-in) QR standees. Shared by the clinic admin's own /manage/qr and the platform
// admin/referrer's Clinic & queue rules tab (Decision 14 / Decision 27) — same UI, different API
// session underneath, same reuse pattern as QueueRules' save/chat props.

const CLINIC = '__clinic__';

export function QrStandees({
  doctors,
  list = () => staffApi.manage.qrCodes(),
  create = (body) => staffApi.manage.createQrCode(body.doctor_id ? { doctor_id: body.doctor_id } : { whole_clinic: true }),
}: {
  doctors: QrStandeeDoctor[];
  list?: () => Promise<QrCodeView[]>;
  create?: (body: { doctor_id?: string; whole_clinic?: boolean }) => Promise<QrCodeView[]>;
}) {
  // Whole clinic by default (a doctor is optional); a solo clinic just gets its doctor.
  const [forId, setForId] = useState(doctors.length > 1 ? CLINIC : (doctors[0]?.id ?? ''));
  const [codes, setCodes] = useState<QrCodeView[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => setCodes(await list()), [list]);
  useEffect(() => {
    load().catch(() => setCodes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doctor = doctors.find((d) => d.id === forId) ?? null;
  const wholeClinic = forId === CLINIC;
  const forName = doctor?.name ?? (wholeClinic ? 'the whole clinic' : '');
  const theirs = (codes ?? []).filter((c) => c.status === 'assigned' && (wholeClinic ? !c.doctor : c.doctor?.id === forId));
  const open = theirs.find((c) => c.id === openId) ?? theirs[0] ?? null;

  const submit = async () => {
    if (!doctor && !wholeClinic) return;
    setBusy(true);
    setMsg(null);
    try {
      const [made] = await create(doctor ? { doctor_id: doctor.id } : { whole_clinic: true });
      await load();
      setOpenId(made.id);
      setMsg({ kind: 'ok', text: `MQ-${made.code} created for ${forName} — download it below.` });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : "Couldn't create the QR code." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">QR standees</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          A clinic QR lets patients pick their doctor. Choose a doctor (optional) and their QR goes straight to their check-in.
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <label className="flex flex-col gap-1 max-w-sm">
          <span className="font-label-md text-label-md">Who is this QR for?</span>
          <select
            value={forId}
            onChange={(e) => {
              setForId(e.target.value);
              setOpenId(null);
              setMsg(null);
            }}
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg"
          >
            {doctors.length > 1 && <option value={CLINIC}>Whole clinic — patient picks the doctor</option>}
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.specialty ? ` — ${d.specialty}` : ''}
              </option>
            ))}
          </select>
        </label>

        {(doctor || wholeClinic) && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {codes === null && <span className="font-body-md text-body-md text-on-surface-variant">Loading…</span>}
              {theirs.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setOpenId(q.id)}
                  className={`px-3 py-1.5 rounded-full font-label-md text-label-md tracking-wider ${open?.id === q.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}
                >
                  MQ-{q.code}
                </button>
              ))}
              <button
                disabled={busy}
                onClick={submit}
                className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <Icon name="add" className="text-[18px]" /> {busy ? 'Creating…' : theirs.length ? 'New QR' : `Create QR for ${forName}`}
              </button>
            </div>
            {codes && theirs.length === 0 && (
              <p className="font-body-md text-body-md text-on-surface-variant">
                {wholeClinic ? 'No whole-clinic QR yet' : `${forName} has no QR yet`}. Create one to print it.
              </p>
            )}
          </>
        )}
        {msg && <p className={`font-body-md text-body-md ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
      </section>

      {(doctor || wholeClinic) && open && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {POSTER_FORMATS.map((f) => (
            <PosterCard key={f.key} kind={f.key} content={posterContentFor(open)} fileBase={`clinicq-MQ-${open.code}`} />
          ))}
        </div>
      )}
    </div>
  );
}
