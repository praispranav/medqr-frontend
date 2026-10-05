'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Icon } from '@/components/patient/ui';
import { inr } from '@/components/staff/bits';
import { LoginShareCard, RatesFields, shortDate } from '@/components/referrals/ReferralParts';
import type { AdminApi, ReferrerRates, ReferrerSummary } from '@/lib/adminApi';

// Decision 27 — Owner › Referrers: referral partners / marketers who onboard clinics. Each gets a
// login to a cut-down panel (their clinics: add doctors & logins, hours, queue rules — no deleting),
// plus a one-time and/or monthly ₹ reward per paying clinic, paid out manually.

export default function ReferrersPage() {
  return <AdminShell active="/owner/referrers">{(api) => <Referrers api={api} />}</AdminShell>;
}

function Referrers({ api }: { api: AdminApi }) {
  const [list, setList] = useState<ReferrerSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [rates, setRates] = useState<ReferrerRates>({ one_time_inr: 500, monthly_inr: 200, payout_frequency: 'monthly', payout_day: 5 });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string; mobile: string | null; password: string } | null>(null);

  const load = () => api.referrers().then(setList).catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createReferrer({ name: name.trim(), email: email.trim(), mobile_number: mobile.trim() || undefined, ...rates });
      setCreated({ name: res.referrer.name, email: res.referrer.email, mobile: res.referrer.mobile_number, password: res.password });
      setName('');
      setEmail('');
      setMobile('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg">Referrers</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Partners and marketers who bring clinics. They can add clinics, doctors and logins and set up hours — never delete anything.
        </p>
      </div>

      {created && <LoginShareCard {...created} onClose={() => setCreated(null)} />}

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <h2 className="font-headline-sm text-headline-sm">Add a referrer</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(
            [
              ['Name', name, setName, 'Rahul Verma', 'text'],
              ['Email (their login)', email, setEmail, 'rahul@example.com', 'email'],
              ['WhatsApp number', mobile, setMobile, '98765 43210', 'tel'],
            ] as const
          ).map(([label, value, set, ph, type]) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="font-label-md text-label-md">{label}</span>
              <input
                type={type}
                value={value}
                placeholder={ph}
                onChange={(e) => set(e.target.value)}
                className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          ))}
        </div>
        <RatesFields value={rates} onChange={setRates} />
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button
          disabled={busy || !name.trim() || !email.trim()}
          onClick={create}
          className="h-12 self-start px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create referrer login'}
        </button>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        {list === null && !error && <p className="p-5 font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        {list?.length === 0 && <p className="p-5 font-body-md text-body-md text-on-surface-variant">No referrers yet.</p>}
        {list?.map((r) => (
          <Link key={r.id} href={`/owner/referrers/${r.id}`} className={`flex items-center gap-4 px-5 py-4 border-b border-surface-container last:border-0 hover:bg-surface-container-low ${r.is_active ? '' : 'opacity-60'}`}>
            <div className="w-10 h-10 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
              <Icon name="handshake" className="text-[22px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-label-lg text-label-lg truncate">
                {r.name}
                {!r.is_active && <span className="ml-2 font-label-sm text-label-sm text-on-surface-variant">(login off)</span>}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {r.clinics} clinic{r.clinics === 1 ? '' : 's'} · {inr(r.one_time_inr)} once + {inr(r.monthly_inr)}/month · next payout {shortDate(r.next_payout)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-headline-sm text-headline-sm ${r.balance_inr > 0 ? 'text-primary' : 'text-on-surface'}`}>{inr(r.balance_inr)}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">due</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
