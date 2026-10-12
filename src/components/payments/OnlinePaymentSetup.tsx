'use client';

import { useEffect, useState } from 'react';
import { api, type ClinicGatewayView } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { GstNote } from '@/components/payments/GstNote';

// Decision 45 — the CLINIC links its own Razorpay account (one per clinic, shared by its doctors) by pasting its API keys.
// Patients then pay into that account (money goes straight to the clinic's bank) and ClinicQ confirms each payment automatically.

const STATE: Record<ClinicGatewayView['stage'], { icon: string; tone: string; title: string; text: string }> = {
  live: { icon: 'check_circle', tone: 'text-tertiary', title: 'Connected', text: 'Patients can pay the clinic online. The money goes straight to the clinic’s bank account.' },
  kyc_pending: { icon: 'hourglass_top', tone: 'text-secondary', title: 'KYC in progress', text: 'Finish the Razorpay KYC, then paste the keys below.' },
  invalid: { icon: 'report', tone: 'text-error', title: 'Needs attention', text: 'Razorpay is not accepting the saved keys. Paste fresh keys below.' },
  not_started: { icon: 'account_balance', tone: 'text-on-surface-variant', title: 'Not connected', text: 'Until the clinic connects, patients pay at the counter.' },
};

const field = 'h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30 w-full';

export function OnlinePaymentSetup() {
  const [v, setV] = useState<ClinicGatewayView | null>(null);
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.clinicGateway().then(setV).catch((e: Error) => setMsg({ kind: 'error', text: e.message }));
  }, []);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      setV(await api.connectClinicGateway(keyId, secret));
      setKeyId('');
      setSecret(''); // don't leave the secret on screen
      setMsg({ kind: 'ok', text: 'Connected. Patients can now pay you online.' });
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect the clinic’s Razorpay account? Patients will pay at the counter until you connect again.')) return;
    setBusy(true);
    try {
      setV(await api.disconnectClinicGateway());
      setMsg({ kind: 'ok', text: 'Disconnected.' });
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!v) return <p className="font-body-md text-body-md text-on-surface-variant">{msg?.text ?? 'Loading…'}</p>;
  const s = STATE[v.stage];
  const canManage = v.can_manage !== false; // only a solo doctor or the clinic admin can change it (Decision 14)

  return (
    <div className="flex flex-col gap-6 max-w-2xl pb-24">
      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Icon name={s.icon} className={`text-[26px] mt-0.5 ${s.tone}`} />
          <div className="flex-1 min-w-0">
            <p className="font-headline-sm text-headline-sm text-on-surface">{s.title}</p>
            <p className="font-body-md text-body-md text-on-surface-variant">{s.text}</p>
            {v.last_error && <p className="font-body-sm text-body-sm text-error mt-1">{v.last_error}</p>}
            {v.stage === 'live' && v.key_hint && (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Razorpay key <span className="font-mono">{v.key_hint}</span> · {v.mode === 'test' ? 'test mode (no real money)' : 'live'}
              </p>
            )}
          </div>
        </div>
        {v.stage === 'live' && canManage && (
          <button onClick={disconnect} disabled={busy} className="self-start h-10 px-4 rounded-xl text-error font-label-md text-label-md disabled:opacity-60">
            Disconnect
          </button>
        )}
      </section>

      {v.stage !== 'live' && !canManage && (
        <p className="font-body-md text-body-md text-on-surface-variant">Online payments are set up once for the whole clinic. Ask your clinic admin to connect it.</p>
      )}

      {v.stage !== 'live' && canManage && (
        <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <p className="font-label-lg text-label-lg text-on-surface">Connect in 3 steps</p>
          <ol className="flex flex-col gap-3 font-body-md text-body-md text-on-surface-variant">
            <li className="flex gap-3">
              <span className="w-7 h-7 shrink-0 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-md text-label-md">1</span>
              <span>
                <strong className="text-on-surface">Have a Razorpay account for the clinic.</strong> The ClinicQ team will help you create it and finish the KYC (PAN and
                bank account). That is done on Razorpay&apos;s own pages — ClinicQ never sees your documents.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-7 h-7 shrink-0 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-md text-label-md">2</span>
              <span>
                <strong className="text-on-surface">Create your keys.</strong> In the clinic’s Razorpay dashboard make sure <em>Live</em> mode is on, then open{' '}
                <em>Account &amp; Settings → API Keys → Generate Key</em>. Razorpay shows the Key Secret only once — copy it straight away.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-7 h-7 shrink-0 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-md text-label-md">3</span>
              <span>
                <strong className="text-on-surface">Paste them here.</strong> ClinicQ checks them with Razorpay and keeps the secret encrypted.
              </span>
            </li>
          </ol>

          <form onSubmit={connect} autoComplete="off" className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Key ID</span>
              <input value={keyId} onChange={(e) => setKeyId(e.target.value.trim())} placeholder="rzp_live_XXXXXXXXXXXXXX" className={field} autoCapitalize="off" spellCheck={false} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Key Secret</span>
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value.trim())} className={field} autoComplete="new-password" spellCheck={false} />
            </label>
            <button disabled={busy || !keyId || !secret} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">
              {busy ? 'Checking with Razorpay…' : 'Connect the clinic’s account'}
            </button>
          </form>
        </section>
      )}

      {msg && <p className={`font-body-sm text-body-sm ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
        <GstNote />
      </section>
    </div>
  );
}
