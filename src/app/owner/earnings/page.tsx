'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { BankForm, Ledger, MoneySummary, scheduleText } from '@/components/referrals/ReferralParts';
import { inr } from '@/components/staff/bits';
import type { AdminApi, ReferrerDetail } from '@/lib/adminApi';

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
      <BankForm bank={r.bank} onSave={async (b) => setR(await api.updateMyBank(b))} />
      <Ledger r={r} />
    </div>
  );
}
