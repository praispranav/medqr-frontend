'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, type PatientPaymentStatus } from '@/lib/api';
import { getQueueSocket, keepLive } from '@/lib/socket';
import { FullPageMessage, Icon, LoadingPage, PatientHeader } from '@/components/patient/ui';
import { UpiQrCard } from '@/components/payments/UpiQrCard';

// Screen #13 — Consultation fee payment (Decisions 8, 9, 10, 11).
// The patient chooses "Pay online (UPI)" or "Pay cash at counter". Online auto-creates a single-use UPI
// QR for this visit; on the patient's own phone the main action is "Open UPI app". The page updates
// live when the payment lands. Payment never blocks the visit: "Pay at counter instead" is always there.

export default function PaymentPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Payment />
    </Suspense>
  );
}

function Payment() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const tokenId = useSearchParams().get('token');
  const router = useRouter();
  const [status, setStatus] = useState<PatientPaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const queueUrl = `/patient/${subdomain}/queue/${tokenId}`;

  const refresh = useCallback(async () => {
    if (!tokenId) return setNotFound(true);
    try {
      setStatus(await api.paymentStatus(tokenId));
    } catch {
      setNotFound(true);
    }
  }, [tokenId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live: the backend pings this token's room when the payment lands (webhook) or the QR expires.
  useEffect(() => {
    if (!tokenId) return;
    const socket = getQueueSocket();
    const join = () => socket.emit('join_token_room', tokenId);
    join();
    socket.on('connect', join);
    socket.on('queue:update', refresh);
    const stopKeepLive = keepLive(refresh); // reconnect on resume + refresh every 15 s while on screen
    return () => {
      socket.off('connect', join);
      socket.off('queue:update', refresh);
      stopKeepLive();
    };
  }, [tokenId, refresh]);

  // Paid → straight on to the live queue.
  useEffect(() => {
    if (status?.is_paid) {
      const t = setTimeout(() => router.replace(queueUrl), 1800);
      return () => clearTimeout(t);
    }
  }, [status?.is_paid, router, queueUrl]);

  const choose = async (choice: 'online' | 'cash') => {
    if (!tokenId) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api.choosePayment(tokenId, choice);
      setStatus(s);
      if (choice === 'cash') router.replace(queueUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start online payment. You can pay at the counter.");
    } finally {
      setBusy(false);
    }
  };

  if (notFound) return <FullPageMessage icon="error" title="Payment link not found" body="Please pay at the reception counter." />;
  if (!status) return <LoadingPage />;

  const fee = `₹${status.fee_inr.toLocaleString('en-IN')}`;
  const qrOpen = status.qr && status.qr.status === 'active' && status.payment_choice === 'online';

  return (
    <>
      <PatientHeader eyebrow={`Token #${status.token_number}`} title="Consultation fee" homeUrl={`/patient/${subdomain}/select-doctor`} />
      <main className="min-h-screen w-full max-w-[480px] mx-auto pt-20 pb-10 px-margin bg-surface flex flex-col gap-4">
        {status.is_paid ? (
          <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center">
              <Icon name="check" fill className="text-[30px]" />
            </div>
            <h1 className="font-headline-md text-headline-md">Payment received</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">{fee} paid. Taking you to your live token…</p>
          </div>
        ) : qrOpen ? (
          <>
            <UpiQrCard qr={status.qr!} onPatientPhone onChanged={refresh} />
            <button
              disabled={busy}
              onClick={() => choose('cash')}
              className="h-12 rounded-xl bg-surface-container-low text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-2"
            >
              <Icon name="payments" className="text-[20px]" /> Pay cash at the counter instead
            </button>
          </>
        ) : (
          <>
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm text-center">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Consultation fee</p>
              <p className="font-display-token text-display-token text-primary">{fee}</p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Your token is confirmed. How would you like to pay?
              </p>
            </div>

            {status.qr === null && status.payment_choice === 'online' && (
              <p className="bg-secondary-fixed/40 rounded-xl p-3 font-body-sm text-body-sm text-on-secondary-fixed-variant">
                The last payment QR expired. Try again or pay at the counter.
              </p>
            )}

            {status.online_available && (
              <button
                disabled={busy}
                onClick={() => choose('online')}
                className="rounded-2xl p-4 bg-primary text-on-primary shadow-md flex items-center gap-3 text-left disabled:opacity-60"
              >
                <span className="w-11 h-11 rounded-xl bg-on-primary/15 flex items-center justify-center shrink-0">
                  <Icon name="qr_code_scanner" className="text-[24px]" />
                </span>
                <span className="flex-1">
                  <span className="block font-label-lg text-label-lg">{busy ? 'Getting your UPI QR…' : `Pay ${fee} online now`}</span>
                  <span className="block font-body-sm text-body-sm opacity-90">GPay, PhonePe, Paytm or any UPI app</span>
                </span>
                <Icon name="arrow_forward" className="text-[22px]" />
              </button>
            )}

            <button
              disabled={busy}
              onClick={() => choose('cash')}
              className="rounded-2xl p-4 bg-surface-container-lowest shadow-sm flex items-center gap-3 text-left disabled:opacity-60"
            >
              <span className="w-11 h-11 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
                <Icon name="payments" className="text-[24px]" />
              </span>
              <span className="flex-1">
                <span className="block font-label-lg text-label-lg text-on-surface">Pay at the counter</span>
                <span className="block font-body-sm text-body-sm text-on-surface-variant">Cash or UPI at reception</span>
              </span>
              <Icon name="arrow_forward" className="text-[22px] text-on-surface-variant" />
            </button>

            {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
          </>
        )}

        <p className="font-body-sm text-body-sm text-on-surface-variant text-center flex items-center justify-center gap-1.5">
          <Icon name="info" className="text-[16px]" />
          Your place in the queue is saved either way.
        </p>
      </main>
    </>
  );
}
