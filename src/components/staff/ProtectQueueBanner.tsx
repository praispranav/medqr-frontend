'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

type Protection = Awaited<ReturnType<typeof api.queueProtection>>;

/**
 * Decision 70 — "Protect your queue": while anyone can book online and nothing stops fake tokens, the doctor /
 * clinic admin sees one-tap fixes: require WhatsApp verification, require the arrival scan (no front desk), or
 * take payment online first (needs the clinic's Razorpay). Hidden for today once dismissed.
 */
export function ProtectQueueBanner({ tenantId, base }: { tenantId: string; base: '/doctor' | '/manage' }) {
  const [p, setP] = useState<Protection | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const key = `clinicq:protect-dismissed:${new Date().toISOString().slice(0, 10)}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      /* ignore */
    }
    api.queueProtection().then(setP).catch(() => undefined);
  }, [key]);

  if (!p?.warn && !done) return null;
  if (done) return <p className="mb-3 rounded-2xl bg-[#E6F4EA] text-[#137333] px-4 py-3 font-body-md text-body-md flex items-center gap-2"><Icon name="verified_user" className="text-[20px]" /> {done}</p>;

  const turnOn = async (patch: Record<string, unknown>, msg: string) => {
    setBusy(true);
    try {
      await api.updateQueueSettings(tenantId, patch);
      setDone(msg);
    } finally {
      setBusy(false);
    }
  };
  const btn = 'h-10 px-4 rounded-xl font-label-md text-label-md inline-flex items-center gap-2 disabled:opacity-50';

  return (
    <section className="mb-3 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Icon name="gpp_maybe" className="text-[24px] text-amber-700 shrink-0" />
        <div className="flex-1">
          <p className="font-label-lg text-label-lg text-amber-900">Protect your queue from fake bookings</p>
          <p className="font-body-sm text-body-sm text-amber-900/80">
            {p!.suspicious
              ? `${p!.unattended_7d} of ${p!.total_7d} tokens in the last 7 days never turned up.`
              : 'Anyone can book a token online right now and nothing checks it.'}{' '}
            Pick one:
          </p>
        </div>
        <button aria-label="Hide for today" onClick={() => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } setP(null); }} className="text-amber-900/60">
          <Icon name="close" className="text-[20px]" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {!p!.otp && (
          <button disabled={busy} onClick={() => turnOn({ require_whatsapp_otp: true }, 'Done — online bookings now need a WhatsApp code.')} className={`${btn} bg-primary text-on-primary`}>
            <Icon name="sms" className="text-[18px]" /> Require WhatsApp verification
          </button>
        )}
        {!p!.arrival && (
          <button disabled={busy} onClick={() => turnOn({ arrival_scan_required: true }, 'Done — patients must scan the arrival QR at the clinic. Print it from Queue Rules.')} className={`${btn} bg-surface-container-lowest text-primary border border-primary/30`}>
            <Icon name="qr_code_scanner" className="text-[18px]" /> Require arrival scan
          </button>
        )}
        {!p!.prepay &&
          (p!.gateway_connected ? (
            <button disabled={busy} onClick={() => turnOn({ payment_mode: 'prepay_remote_only' }, 'Done — patients booking from outside the clinic pay online first.')} className={`${btn} bg-surface-container-lowest text-primary border border-primary/30`}>
              <Icon name="currency_rupee" className="text-[18px]" /> Ask for online payment first
            </button>
          ) : (
            <Link href={`${base}/online-payments`} className={`${btn} bg-surface-container-lowest text-primary border border-primary/30`}>
              <Icon name="currency_rupee" className="text-[18px]" /> Set up online payment
            </Link>
          ))}
      </div>
    </section>
  );
}
