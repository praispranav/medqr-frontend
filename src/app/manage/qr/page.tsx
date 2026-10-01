'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type DoctorToday, type QrCodeView } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { StaffShell } from '@/components/staff/StaffShell';
import { PosterCard, posterContentFor, POSTER_FORMATS } from '@/components/qr/QrPoster';

// Clinic admin — QR standees for the whole clinic (default; scan opens doctor selection) or,
// optionally, one doctor (scan goes straight to that doctor's check-in, no doctor selection). Both are MQ codes, so they count scans and never need reprinting.

const CLINIC = '__clinic__';

export default function ManageQrPage() {
  return (
    <StaffShell variant="manage" active="/manage/qr">
      {({ doctors }) => <QrStandees doctors={doctors} />}
    </StaffShell>
  );
}

function QrStandees({ doctors }: { doctors: DoctorToday[] }) {
  // Whole clinic by default (a doctor is optional); a solo clinic just gets its doctor.
  const [forId, setForId] = useState(doctors.length > 1 ? CLINIC : (doctors[0]?.id ?? ''));
  const [codes, setCodes] = useState<QrCodeView[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => setCodes(await api.manage.qrCodes()), []);
  useEffect(() => {
    load().catch(() => setCodes([]));
  }, [load]);

  const doctor = doctors.find((d) => d.id === forId) ?? null;
  const wholeClinic = forId === CLINIC;
  const forName = doctor?.name ?? (wholeClinic ? 'the whole clinic' : '');
  const theirs = (codes ?? []).filter((c) => c.status === 'assigned' && (wholeClinic ? !c.doctor : c.doctor?.id === forId));
  const open = theirs.find((c) => c.id === openId) ?? theirs[0] ?? null;

  const create = async () => {
    if (!doctor && !wholeClinic) return;
    setBusy(true);
    setMsg(null);
    try {
      const [made] = await api.manage.createQrCode(doctor ? { doctor_id: doctor.id } : { whole_clinic: true });
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
    <div className="max-w-6xl flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">QR standees</h1>
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
                onClick={create}
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
            <PosterCard key={f.key} kind={f.key} content={posterContentFor(open)} fileBase={`medqr-MQ-${open.code}`} />
          ))}
        </div>
      )}

    </div>
  );
}
