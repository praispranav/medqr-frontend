'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { FullPageMessage, Icon, LoadingPage, PatientHeader } from '@/components/patient/ui';

// Decision 21: where the clinic's arrival QR points (the clinic's own patient site — <clinic>.medqr.in/arrive,
// or /patient/<clinic>/arrive — so it sees the tokens this phone saved on that site). A patient scans it with the phone camera; this
// page finds the token(s) this phone holds for that clinic today and checks them in — no typing,
// no app. (The token page has its own "Scan arrival QR" button that does the same thing.)

type Stored = { id: string; number: number; patient_name?: string; doctor_name?: string; status?: string; clinic_subdomain?: string };
type Result = { token: Stored; ok: boolean; already?: boolean; error?: string };

export default function ArrivePage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('c') ?? '';
    let stored: Stored[] = [];
    try {
      stored = JSON.parse(localStorage.getItem('medqr_patient_tokens') || '[]');
    } catch {
      /* no saved tokens */
    }
    const mine = stored.filter(
      (t) => t.clinic_subdomain === subdomain && !['done', 'no_show', 'expired', 'cancelled'].includes(t.status ?? ''),
    );
    Promise.all(
      mine.map(async (token): Promise<Result> => {
        try {
          const r = await api.arriveByScan(token.id, code);
          return { token, ok: true, already: r.already };
        } catch (e) {
          return { token, ok: false, error: e instanceof ApiError ? e.message : 'Could not reach MedQR' };
        }
      }),
    ).then(setResults);
  }, [subdomain]);

  if (!results) return <LoadingPage />;

  const done = results.filter((r) => r.ok);
  if (results.length === 0) {
    return (
      <FullPageMessage
        icon="confirmation_number"
        title="No token on this phone"
        body="Get your token first, then scan this QR again. If your token is on another phone, scan with that phone."
      />
    );
  }
  if (done.length === 0) {
    const notToday = results.every((r) => /not for today/i.test(r.error ?? ''));
    return (
      <FullPageMessage
        icon="error"
        title={notToday ? 'Your token is for another day' : 'Couldn’t check you in'}
        body={notToday ? 'Come back on the day of your booking and scan again.' : results[0].error}
      />
    );
  }

  return (
    <>
      <PatientHeader eyebrow="MedQR · Arrival" title="You're checked in" />
      <main className="min-h-screen w-full max-w-[480px] mx-auto pt-20 px-6 flex flex-col items-center text-center gap-4 bg-surface">
        <div className="w-16 h-16 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
          <Icon name="how_to_reg" className="text-[32px]" />
        </div>
        <h1 className="font-headline-md text-headline-md text-on-surface">Thanks — you&apos;re here!</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Please wait nearby. The doctor will call your token number.</p>
        <div className="w-full flex flex-col gap-2 mt-2">
          {done.map((r) => (
            <Link
              key={r.token.id}
              href={`/patient/${subdomain}/queue/${r.token.id}`}
              className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left"
            >
              <span className="font-headline-md text-headline-md text-primary w-16">#{r.token.number}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-label-lg text-label-lg truncate">{r.token.patient_name ?? 'Your token'}</span>
                <span className="block font-body-sm text-body-sm text-on-surface-variant truncate">{r.token.doctor_name}</span>
              </span>
              <Icon name="chevron_right" className="text-[22px] text-on-surface-variant" />
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
