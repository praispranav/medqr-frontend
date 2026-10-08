'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { Icon } from '@/components/patient/ui';
import type { AdminApi, Coupon, ReferrerSummary } from '@/lib/adminApi';
import { describeCoupon } from '@/lib/coupons';

// Decision 36 — Owner › Coupons. A coupon gives free trial months and/or a % off the monthly bill for
// N months; then the normal price returns by itself. Issue a code to a referrer so they can use it
// when adding clinics. A coupon only changes price — it never links the clinic to a referrer.

export default function CouponsPage() {
  return <AdminShell active="/owner/coupons">{(api) => <Coupons api={api} />}</AdminShell>;
}

const shortDate = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

function Coupons({ api }: { api: AdminApi }) {
  const [list, setList] = useState<Coupon[] | null>(null);
  const [referrers, setReferrers] = useState<ReferrerSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: '', percent_off: '40', discount_months: '12', free_months: '0', max_uses: '', valid_until: '', referrer_id: '', note: '' });

  const load = () => api.coupons().then(setList).catch((e: Error) => setError(e.message));
  useEffect(() => {
    load();
    api.referrers().then(setReferrers).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const refName = (id: string | null) => (id ? (referrers.find((r) => r.id === id)?.name ?? 'Referrer') : null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const num = (v: string) => Number(v.replace(/\D/g, '') || 0);
  const input = 'h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30';

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createCoupon({
        code: form.code.trim().toUpperCase(),
        percent_off: num(form.percent_off),
        discount_months: num(form.discount_months),
        free_months: num(form.free_months),
        max_uses: form.max_uses ? num(form.max_uses) : null,
        valid_until: form.valid_until || null,
        referrer_id: form.referrer_id || null,
        note: form.note.trim() || null,
      });
      setForm({ ...form, code: '', note: '' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const preview = describeCoupon({ percent_off: num(form.percent_off), discount_months: num(form.discount_months), free_months: num(form.free_months) });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg">Coupons</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Discounts for selected clinics. Free months extend the free trial; the % off starts when paid billing starts and ends by itself. Apply a code from a clinic’s page, or issue it to a referrer to use when they add clinics.
        </p>
      </div>

      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <h2 className="font-headline-sm text-headline-sm">New coupon</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Code</span>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} placeholder="DOCTOR40" className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">% off</span>
            <input inputMode="numeric" value={form.percent_off} onChange={set('percent_off')} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">For how many months</span>
            <input inputMode="numeric" value={form.discount_months} onChange={set('discount_months')} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Free months (trial)</span>
            <input inputMode="numeric" value={form.free_months} onChange={set('free_months')} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Issue to referrer</span>
            <select value={form.referrer_id} onChange={set('referrer_id')} className={input}>
              <option value="">MedQR only (not issued)</option>
              {referrers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Max uses (optional)</span>
            <input inputMode="numeric" value={form.max_uses} onChange={set('max_uses')} placeholder="Unlimited" className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Use by (optional)</span>
            <input type="date" value={form.valid_until} onChange={set('valid_until')} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Note (optional)</span>
            <input value={form.note} onChange={set('note')} placeholder="Diwali offer" className={input} />
          </label>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{preview ? `Gives: ${preview}, then the normal price.` : 'Give free months or a % off.'}</p>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button disabled={busy || form.code.length < 3} onClick={create} className="h-12 self-start px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">
          {busy ? 'Creating…' : 'Create coupon'}
        </button>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        {list === null && !error && <p className="p-5 font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        {list?.length === 0 && <p className="p-5 font-body-md text-body-md text-on-surface-variant">No coupons yet.</p>}
        {list?.map((c) => (
          <div key={c.id} className={`px-5 py-4 border-b border-surface-container last:border-0 flex flex-wrap items-start gap-3 ${c.is_active ? '' : 'opacity-60'}`}>
            <div className="w-10 h-10 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
              <Icon name="sell" className="text-[22px]" />
            </div>
            <div className="flex-1 min-w-[220px]">
              <p className="font-label-lg text-label-lg">
                {c.code}
                {!c.is_active && <span className="ml-2 font-label-sm text-label-sm text-on-surface-variant">(off)</span>}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {describeCoupon(c)} · used {c.used_count}
                {c.max_uses !== null ? ` of ${c.max_uses}` : ''}
                {c.valid_until ? ` · use by ${shortDate(c.valid_until)}` : ''}
                {refName(c.referrer_id) ? ` · issued to ${refName(c.referrer_id)}` : ''}
                {c.note ? ` · ${c.note}` : ''}
              </p>
              {!!c.clinics?.length && (
                <p className="font-body-sm text-body-sm text-on-surface mt-1">
                  {c.clinics.map((x) => `${x.name}${x.discount_until ? ` (until ${shortDate(x.discount_until)})` : ''}`).join(' · ')}
                </p>
              )}
            </div>
            <button
              onClick={async () => {
                await api.updateCoupon(c.id, { is_active: !c.is_active }).catch((e: Error) => setError(e.message));
                await load();
              }}
              className="h-10 px-4 rounded-xl bg-surface-container-low text-on-surface-variant font-label-md text-label-md"
            >
              {c.is_active ? 'Turn off' : 'Turn on'}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
