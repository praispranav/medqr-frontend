'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type ClinicGatewayView } from '@/lib/api';
import { clinicToday } from '@/lib/clinicTime';
import { Icon } from '@/components/patient/ui';

// Decision 45 — online payment is OFF until the clinic connects its Razorpay account, so whoever can set it up (the solo doctor
// or the clinic admin) is reminded at the top of the portal each day until it is done. "Remind me tomorrow" hides it for today only; it comes back the next day.

const KEY = 'clinicq:online-pay-banner';

export function OnlinePaymentBanner({ href = '/doctor/online-payments' }: { href?: string }) {
  const [v, setV] = useState<ClinicGatewayView | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === clinicToday());
    } catch {
      setHidden(false);
    }
    api.clinicGateway().then(setV).catch(() => setV(null)); // best-effort, never blocks the screen
  }, []);

  if (!v || v.stage === 'live' || v.can_manage === false || hidden) return null;

  const text =
    v.stage === 'invalid'
      ? 'The clinic’s Razorpay keys stopped working, so patients cannot pay online. Reconnect the account.'
      : v.stage === 'kyc_pending'
        ? 'Online payments are off. Finish the Razorpay KYC, then connect the clinic’s account so patients can pay online.'
        : 'Online payments are off for your patients. Connect the clinic’s Razorpay account so they can pay online.';

  return (
    <div className="mb-4 rounded-xl bg-tertiary-container text-white px-4 py-3 flex items-center gap-3 flex-wrap">
      <Icon name="account_balance" className="text-[20px] shrink-0 text-white" />
      <p className="font-body-md text-body-md flex-1 min-w-[200px] text-white">{text}</p>
      <Link href={href} className="h-9 px-4 rounded-full bg-white text-tertiary font-label-md text-label-md flex items-center">
        Set up now
      </Link>
      <button
        onClick={() => {
          try {
            localStorage.setItem(KEY, clinicToday());
          } catch {
            /* private mode: hidden until reload */
          }
          setHidden(true);
        }}
        className="h-9 px-3 rounded-full text-white/90 font-label-md text-label-md"
      >
        Remind me tomorrow
      </button>
    </div>
  );
}
