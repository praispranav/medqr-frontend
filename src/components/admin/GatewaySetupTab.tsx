'use client';

import { useEffect, useState } from 'react';
import type { ClinicGatewayView } from '@/lib/api';
import type { AdminApi } from '@/lib/adminApi';
import { Icon } from '@/components/patient/ui';

// Decision 45 — helping a clinic connect its OWN Razorpay account (one per clinic): a checklist message to send, a
// "KYC in progress" marker, and a place to paste the clinic's API keys on its behalf (the solo doctor / clinic admin can also
// do it themselves in the portal). Super admin only. Keys are checked with Razorpay and stored encrypted; the secret is never shown again.

const STAGE: Record<ClinicGatewayView['stage'], { label: string; tone: string }> = {
  not_started: { label: 'Not started', tone: 'bg-surface-container text-on-surface-variant' },
  kyc_pending: { label: 'KYC in progress', tone: 'bg-secondary-fixed text-on-secondary-fixed' },
  live: { label: 'Live', tone: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  invalid: { label: 'Keys not working', tone: 'bg-error-container text-on-error-container' },
};

const CHECKLIST = (clinic: string) =>
  `Hello, to let patients of ${clinic} pay online (money goes straight to the clinic's bank account) please send me:\n\n` +
  `1. PAN card photo (of the clinic owner / proprietor)\n2. Bank account number + IFSC (or a passbook / cancelled cheque photo)\n3. Mobile number and email\n4. Clinic address\n\n` +
  `I will start the clinic's Razorpay account; you will get a link from Razorpay to finish the KYC. Once it is active, I will help you create the API keys and connect them in ClinicQ.`;

const field = 'h-11 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30 w-full';

export function GatewaySetupTab({ api, tenantId, clinicName }: { api: AdminApi; tenantId: string; clinicName: string }) {
  const [v, setV] = useState<ClinicGatewayView | null>(null);
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.gateway(tenantId).then(setV).catch((e: Error) => setMsg({ kind: 'error', text: e.message }));
  }, [api, tenantId]);

  const run = async (fn: () => Promise<ClinicGatewayView>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      setV(await fn());
      setMsg({ kind: 'ok', text: ok });
      setKeyId('');
      setSecret('');
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CHECKLIST(clinicName));
      setMsg({ kind: 'ok', text: 'Message copied — paste it into WhatsApp.' });
    } catch {
      setMsg({ kind: 'error', text: 'Could not copy — select the text manually.' });
    }
  };

  const st = STAGE[v?.stage ?? 'not_started'];

  return (
    <div className="flex flex-col gap-4 pb-24">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Each clinic uses its own Razorpay account (one account for the whole clinic), so patient fees go straight to the clinic&apos;s bank account. Start the
        account from your Razorpay Partner dashboard (Add New Account), then connect the API keys here — or let the solo doctor / clinic admin do it from{' '}
        <em>Online payment setup</em> in their menu.
      </p>
      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Icon name="account_balance" className="text-primary text-[22px]" />
          <p className="font-headline-sm text-headline-sm flex-1 min-w-0 truncate">Online payments · {clinicName}</p>
          <span className={`px-3 py-1 rounded-full font-label-md text-label-md ${st.tone}`}>{st.label}</span>
        </div>

        {v?.stage === 'live' ? (
          <div className="flex flex-col gap-2">
            <p className="font-body-md text-body-md">
              Razorpay key <span className="font-mono">{v.key_hint}</span> · {v.mode === 'test' ? 'test mode' : 'live'}
            </p>
            <button
              disabled={busy}
              onClick={() => window.confirm('Disconnect this clinic’s Razorpay account? Its patients will pay at the counter.') && run(() => api.disconnectGateway(tenantId), 'Disconnected')}
              className="self-start h-10 px-4 rounded-xl text-error font-label-md text-label-md disabled:opacity-60"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {v?.last_error && <p className="font-body-sm text-body-sm text-error">{v.last_error}</p>}
            <div className="flex gap-2 flex-wrap">
              <button onClick={copy} className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md flex items-center gap-2">
                <Icon name="content_copy" className="text-[18px]" /> Copy checklist message
              </button>
              {v?.stage === 'not_started' && (
                <button disabled={busy} onClick={() => run(() => api.gatewayKycPending(tenantId), 'Marked: KYC in progress')} className="h-10 px-4 rounded-xl bg-surface-container-low text-primary font-label-md text-label-md disabled:opacity-60">
                  Mark KYC in progress
                </button>
              )}
            </div>
            <form
              autoComplete="off"
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api.connectGateway(tenantId, keyId, secret), 'Connected — patients can now pay this clinic online');
              }}
            >
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Key ID</span>
                <input value={keyId} onChange={(e) => setKeyId(e.target.value.trim())} placeholder="rzp_live_XXXXXXXXXXXXXX" className={field} autoCapitalize="off" spellCheck={false} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Key Secret</span>
                <input type="password" value={secret} onChange={(e) => setSecret(e.target.value.trim())} className={field} autoComplete="new-password" spellCheck={false} />
              </label>
              <button disabled={busy || !keyId || !secret} className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">
                {busy ? 'Checking…' : 'Connect'}
              </button>
            </form>
          </div>
        )}

        {msg && <p className={`font-body-sm text-body-sm ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
      </section>
    </div>
  );
}
