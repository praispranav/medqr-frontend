'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, type PaymentQrView } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// One auto-created, single-use UPI QR for one visit (Decision 11). The QR encodes the gateway's own
// upi://pay link, so the same string also powers "Open UPI app" on the patient's phone (you can't
// scan a QR shown on the phone you're holding).

function useCountdown(until: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return { secs, label: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` };
}

export function UpiQrCard({
  qr,
  onPatientPhone = false,
  onChanged,
  onSimulate,
  label: payLabel,
}: {
  qr: PaymentQrView;
  /** Patient's own phone: lead with "Open UPI app"; the QR is for paying from another phone. */
  onPatientPhone?: boolean;
  onChanged?: () => void;
  /** Defaults to the visit-payment simulate endpoint; pass a different one for other QR kinds (e.g. wallet recharge). */
  onSimulate?: () => Promise<unknown>;
  /** Defaults to "Pay ₹N by UPI" — override for a non-visit QR (e.g. "Recharge ₹N by UPI"). */
  label?: string;
}) {
  const { secs, label } = useCountdown(qr.close_by);
  const [simulating, setSimulating] = useState(false);
  const expired = secs === 0;

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col items-center text-center gap-3">
      <div className="flex items-center gap-2">
        <Icon name="qr_code_2" className="text-primary text-[20px]" />
        <p className="font-label-lg text-label-lg">{payLabel ?? `Pay ₹${qr.amount_inr.toLocaleString('en-IN')} by UPI`}</p>
        {qr.gateway === 'mock' && (
          <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">Test mode</span>
        )}
      </div>

      {/* The mock gateway's upi_uri is a real upi://pay deep link; Razorpay's QR Codes API only ever
          gives back a scannable image (image_url), never a deep link — so "Open UPI app" only ever
          promises something it can deliver on. */}
      {onPatientPhone && !expired && qr.gateway === 'mock' && (
        <a
          href={qr.upi_uri}
          className="w-full h-14 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-md"
        >
          <Icon name="account_balance_wallet" className="text-[20px]" />
          Open UPI app (GPay, PhonePe, Paytm)
        </a>
      )}

      <div className={`p-3 bg-white rounded-xl border border-surface-container ${expired ? 'opacity-30' : ''}`}>
        {qr.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr.image_url} alt="UPI QR code" width={onPatientPhone ? 180 : 220} height={onPatientPhone ? 180 : 220} className="object-contain" />
        ) : (
          <QRCodeSVG value={qr.upi_uri} size={onPatientPhone ? 180 : 220} level="M" marginSize={2} />
        )}
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {!onPatientPhone
          ? 'Ask the patient to scan with any UPI app.'
          : qr.gateway === 'mock'
            ? 'Or scan this from another phone.'
            : 'Scan this with a UPI app from another phone.'}
      </p>

      <p className={`font-label-md text-label-md flex items-center gap-1.5 ${expired ? 'text-error' : 'text-on-surface-variant'}`}>
        <span className="relative flex h-2.5 w-2.5">
          {!expired && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${expired ? 'bg-error' : 'bg-primary'}`} />
        </span>
        {expired ? 'This QR has expired' : `Waiting for payment · expires in ${label}`}
      </p>

      {qr.gateway === 'mock' && !expired && (
        <button
          disabled={simulating}
          onClick={async () => {
            setSimulating(true);
            await (onSimulate ? onSimulate() : api.simulateQrPayment(qr.id)).catch(() => undefined);
            setSimulating(false);
            onChanged?.();
          }}
          className="font-label-md text-label-md text-secondary underline underline-offset-4 disabled:opacity-50"
        >
          {simulating ? 'Simulating…' : 'Simulate UPI payment (test mode only)'}
        </button>
      )}
    </div>
  );
}
