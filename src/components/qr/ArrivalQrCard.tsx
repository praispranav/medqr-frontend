'use client';

import { useEffect, useState } from 'react';
import { ApiError, type ArrivalQr } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { PosterCard, POSTER_FORMATS, type PosterContent } from '@/components/qr/QrPoster';

// Decision 21: ONE arrival QR for the whole clinic (not per doctor). Patients scan it when they
// reach the clinic; that confirms their arrival so the doctor can call them. Shown by default on
// every QR page. Regenerating makes all printed copies stop working (e.g. a photo is circulating).

export function ArrivalQrCard({
  load,
  regenerate,
  rulesHint,
}: {
  load: () => Promise<ArrivalQr>;
  /** Only for whoever may manage the clinic. */
  regenerate?: () => Promise<ArrivalQr>;
  /** Where the on/off switch lives, for the "not switched on" note. */
  rulesHint: string;
}) {
  const [qr, setQr] = useState<ArrivalQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load().then(setQr).catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content: PosterContent | null = qr && {
    url: qr.url,
    title: qr.clinic_name,
    subtitle: 'Arrival check-in',
    headline: 'Scan when you arrive',
    tagline: 'Any phone camera · tells the doctor you’re here',
    footer: 'One arrival QR for all doctors',
    codeLabel: 'ARRIVAL',
    steps: ['Scan', 'Checked in', 'Wait for call'],
  };

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="max-w-2xl">
          <h2 className="font-headline-sm text-headline-sm">Arrival QR — whole clinic</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Put this up at the entrance or waiting area. Patients scan it with their phone camera when they arrive — that checks them in, so the
            doctor can call them. One QR for every doctor.
          </p>
          {qr && !qr.required && (
            <p className="mt-2 font-body-sm text-body-sm text-secondary flex items-start gap-1.5">
              <Icon name="info" className="text-[16px] mt-0.5" /> Not switched on yet — patients don&apos;t need it until “Patients confirm arrival by
              scanning” is on in {rulesHint}.
            </p>
          )}
        </div>
        {regenerate && qr && (
          <button
            disabled={busy}
            onClick={async () => {
              if (!window.confirm('Make a new arrival QR? Every printed arrival poster stops working — you will need to print and put up the new one.')) return;
              setBusy(true);
              setError(null);
              try {
                setQr(await regenerate());
              } catch (e) {
                setError(e instanceof ApiError ? e.message : (e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className="h-10 px-4 rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="autorenew" className="text-[18px]" /> Make a new QR
          </button>
        )}
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      {!qr && !error && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
      {content && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {POSTER_FORMATS.map((f) => (
            <PosterCard key={`${f.key}-${qr!.code}`} kind={f.key} content={content} fileBase={`medqr-arrival-${qr!.subdomain}`} />
          ))}
        </div>
      )}
    </section>
  );
}
