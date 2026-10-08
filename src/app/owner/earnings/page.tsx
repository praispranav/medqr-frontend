'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { BankForm, Ledger, MoneySummary, scheduleText } from '@/components/referrals/ReferralParts';
import { inr } from '@/components/staff/bits';
import type { AdminApi, Coupon, ReferrerDetail } from '@/lib/adminApi';
import { describeCoupon } from '@/lib/coupons';

// Decision 27 — a referral partner's own page: what they've earned, what's due, when MedQR pays,
// and the bank / UPI details rewards are sent to.

export default function MyEarningsPage() {
  return <AdminShell active="/owner/earnings">{(api) => <MyEarnings api={api} />}</AdminShell>;
}

function MyEarnings({ api }: { api: AdminApi }) {
  const [r, setR] = useState<ReferrerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.myEarnings().then(setR).catch((e: Error) => setError(e.message));
  }, [api]);

  if (error) return <p className="font-body-md text-body-md text-error">{error}</p>;
  if (!r) return <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg">My earnings</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          {[r.one_time_inr > 0 && `${inr(r.one_time_inr)} when a clinic starts paying`, r.monthly_inr > 0 && `${inr(r.monthly_inr)} a month while it keeps paying`]
            .filter(Boolean)
            .join(' + ') || 'No reward amounts set yet — MedQR will set them.'}
          {' · '}Paid out {scheduleText(r).toLowerCase()}.
        </p>
      </div>
      <MoneySummary r={r} />
      <MyCoupons api={api} />
      <BankForm bank={r.bank} onSave={async (b) => setR(await api.updateMyBank(b))} />
      <Ledger r={r} />
    </div>
  );
}

/** Decision 36: the coupon codes MedQR issued to this referrer — share them; use one when adding a clinic. */
function MyCoupons({ api }: { api: AdminApi }) {
  const [list, setList] = useState<Coupon[] | null>(null);
  useEffect(() => {
    api.myCoupons().then(setList).catch(() => setList([]));
  }, [api]);
  if (!list?.length) return null;
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div>
        <h2 className="font-headline-sm text-headline-sm">Your coupon codes</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Pick one when you add a clinic (My clinics → Add a clinic).</p>
      </div>
      {list.map((c) => (
        <div key={c.id} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-3">
          <span className="font-headline-sm text-headline-sm tracking-wider">{c.code}</span>
          <span className="flex-1 font-body-sm text-body-sm text-on-surface-variant">
            {describeCoupon(c)}
            {c.max_uses !== null ? ` · ${Math.max(0, c.max_uses - c.used_count)} uses left` : ''}
          </span>
          <button onClick={() => navigator.clipboard?.writeText(c.code)} className="h-9 px-3 rounded-lg text-primary font-label-md text-label-md">
            Copy
          </button>
        </div>
      ))}
    </section>
  );
}
