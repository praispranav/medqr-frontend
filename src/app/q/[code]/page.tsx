'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError, type Me, type QrResolve } from '@/lib/api';
import { FullPageMessage, Icon, LoadingPage } from '@/components/patient/ui';

// What a scanned standalone standee (/q/<code>) opens.
// - Assigned to a doctor → straight into that doctor's check-in (skips doctor selection).
// - Assigned to a whole clinic → that clinic's doctor selection.
// - Unassigned → a logged-in doctor can link it to themselves ("scan to claim"); patients are told to
//   ask reception. Codes are handed out at onboarding before they belong to anyone.
// - Disabled  → no longer active.

export default function QrEntryPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [qr, setQr] = useState<QrResolve | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.resolveQr(code);
        if (r.status === 'assigned' && r.clinic && !r.doctor) {
          router.replace(`/patient/${r.clinic.subdomain}`); // whole-clinic QR → pick the doctor
          return;
        }
        if (r.status === 'assigned' && r.clinic && r.doctor && r.doctor.today_status !== 'off_today') {
          router.replace(`/patient/${r.clinic.subdomain}/intake?doctorId=${r.doctor.id}`); // doctor QR → no selection
          return;
        }
        setQr(r);
        if (r.status === 'unassigned') setMe(await api.me().catch(() => null));
      } catch {
        setNotFound(true);
      }
    })();
  }, [code, router]);

  if (notFound) return <FullPageMessage icon="qr_code_2" title="QR code not recognised" body="Please ask the reception desk to check you in." />;
  if (!qr) return <LoadingPage />;

  const printed = `MQ-${qr.code}`;

  if (qr.status === 'disabled') {
    return <FullPageMessage icon="block" title="This QR code is no longer active" body="Please ask the reception desk to check you in." />;
  }

  if (qr.status === 'assigned' && qr.doctor) {
    // Only reached when the doctor is off today (Decision 6).
    return (
      <FullPageMessage
        icon="event_busy"
        title={`${qr.doctor.name} is not consulting today`}
        body={`${qr.doctor.today_status_detail}. Please check with the reception desk at ${qr.clinic?.name ?? 'the clinic'}.`}
      />
    );
  }

  // ---- Unassigned ----
  const isDoctor = me?.user.role === 'doctor';

  if (claimed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-3 bg-surface">
        <div className="w-14 h-14 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
          <Icon name="check" fill className="text-[30px]" />
        </div>
        <h1 className="font-headline-md text-headline-md">QR linked to you</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
          {printed} now belongs to {me?.user.name}. Patients who scan it go straight to your check-in.
        </p>
        <Link href="/doctor/qr-poster" className="h-12 px-5 mt-2 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center">
          See my QR codes
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4 text-center">
        <div className="w-14 h-14 mx-auto rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
          <Icon name="qr_code_2" className="text-[30px]" />
        </div>
        <div>
          <p className="font-label-sm text-label-sm text-on-surface-variant tracking-wider">{printed}</p>
          <h1 className="font-headline-md text-headline-md text-on-surface mt-1">
            {isDoctor ? 'Link this QR to you?' : "This QR code isn't set up yet"}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {isDoctor
              ? `Patients who scan it will check in with ${me!.user.name} at ${me!.tenant.display_name ?? me!.tenant.subdomain}.`
              : 'Patients: please ask the reception desk to check you in.'}
          </p>
        </div>

        {isDoctor ? (
          <button
            disabled={claiming}
            onClick={async () => {
              setClaiming(true);
              setError(null);
              try {
                await api.claimQr(qr.code);
                setClaimed(true);
              } catch (e) {
                setError(e instanceof ApiError ? e.message : "Couldn't link the QR. Try again.");
                setClaiming(false);
              }
            }}
            className="h-14 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Icon name="link" className="text-[20px]" />
            {claiming ? 'Linking…' : `Link to ${me!.user.name}`}
          </button>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(`/q/${qr.code}`)}`}
            className="h-12 rounded-xl bg-surface-container-low text-primary font-label-lg text-label-lg flex items-center justify-center gap-2"
          >
            <Icon name="stethoscope" className="text-[20px]" /> I&apos;m the doctor — log in to link it
          </Link>
        )}
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      </div>
    </main>
  );
}
