'use client';

import { useState } from 'react';
import { inr } from '@/components/staff/bits';
import { Icon } from '@/components/patient/ui';
import type { ReferrerBank, ReferrerDetail, ReferrerRates } from '@/lib/adminApi';

// Decision 27 — pieces shared by Owner › Referrers › <name> (super admin) and My earnings (the referrer).

const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function scheduleText(r: Pick<ReferrerDetail, 'payout_frequency' | 'payout_day'>) {
  return r.payout_frequency === 'weekly' ? `Every ${WEEKDAYS[r.payout_day]}` : `Monthly, on the ${ordinal(r.payout_day)}`;
}

export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
}

export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

const monthLabel = (period: string) =>
  new Date(`${period}-01T00:00:00+05:30`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** Balance due, earned, paid and the next payout date. */
export function MoneySummary({ r }: { r: ReferrerDetail }) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {(
        [
          ['Due now', inr(r.balance_inr), r.balance_inr > 0 ? 'text-primary' : 'text-on-surface'],
          ['Earned so far', inr(r.earned_inr), 'text-on-surface'],
          ['Paid so far', inr(r.paid_inr), 'text-on-surface'],
          ['Next payout', shortDate(r.next_payout), 'text-on-surface'],
        ] as const
      ).map(([label, value, cls]) => (
        <div key={label} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">{label}</p>
          <p className={`font-headline-md text-headline-md ${cls}`}>{value}</p>
        </div>
      ))}
    </section>
  );
}

/** Rewards and payouts, newest first. `onVoid` (super admin only) cancels a reward line. */
export function Ledger({ r, onVoid }: { r: ReferrerDetail; onVoid?: (id: string) => void }) {
  const rows = [
    ...r.earnings.map((e) => ({ at: e.created_at, key: e.id, kind: 'earning' as const, e })),
    ...r.payouts.map((p) => ({ at: p.paid_at, key: p.id, kind: 'payout' as const, p })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
      <h2 className="font-headline-sm text-headline-sm px-5 pt-5 pb-3">Rewards & payouts</h2>
      {rows.length === 0 && (
        <p className="px-5 pb-5 font-body-md text-body-md text-on-surface-variant">
          Nothing yet. Rewards appear once a clinic is on a paid MedQR plan (not during the free trial).
        </p>
      )}
      {rows.map((row) =>
        row.kind === 'earning' ? (
          <div key={row.key} className={`px-5 py-3 border-t border-surface-container flex items-center gap-3 ${row.e.voided_at ? 'opacity-50' : ''}`}>
            <Icon name="add_circle" className="text-[20px] text-tertiary" />
            <div className="flex-1 min-w-0">
              <p className="font-label-lg text-label-lg truncate">
                {row.e.kind === 'one_time' ? 'Joining reward' : `Monthly reward · ${monthLabel(row.e.period)}`} — {row.e.clinic_name}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {shortDate(row.e.created_at)}
                {row.e.voided_at ? ` · cancelled: ${row.e.void_reason}` : ''}
              </p>
            </div>
            <span className={`font-label-lg text-label-lg ${row.e.voided_at ? 'line-through' : 'text-tertiary'}`}>+{inr(row.e.amount_inr)}</span>
            {onVoid && !row.e.voided_at && (
              <button onClick={() => onVoid(row.e.id)} className="h-9 px-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:text-error">
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div key={row.key} className="px-5 py-3 border-t border-surface-container flex items-center gap-3 bg-surface-container-low/50">
            <Icon name="payments" className="text-[20px] text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-label-lg text-label-lg">Paid by {row.p.method === 'bank' ? 'bank transfer' : row.p.method === 'upi' ? 'UPI' : 'cash'}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {shortDate(row.p.paid_at)}
                {row.p.reference ? ` · ${row.p.reference}` : ''}
              </p>
            </div>
            <span className="font-label-lg text-label-lg text-on-surface">−{inr(row.p.amount_inr)}</span>
          </div>
        ),
      )}
    </section>
  );
}

/** Bank account + UPI for reward transfers. Everything optional; the server checks IFSC / UPI format. */
export function BankForm({ bank, onSave }: { bank: ReferrerBank; onSave: (b: Partial<ReferrerBank>) => Promise<unknown> }) {
  const [b, setB] = useState<ReferrerBank>(bank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (key: keyof ReferrerBank, label: string, placeholder: string, mode?: 'numeric') => (
    <label className="flex flex-col gap-1">
      <span className="font-label-md text-label-md">{label}</span>
      <input
        value={(b[key] as string | null) ?? ''}
        inputMode={mode}
        placeholder={placeholder}
        onChange={(e) => setB({ ...b, [key]: e.target.value })}
        className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div>
        <h2 className="font-headline-sm text-headline-sm">Where rewards are sent</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Bank account or UPI ID — either is enough.
          {bank.updated_at ? ` Last changed ${shortDate(bank.updated_at)} by ${bank.updated_by}.` : ''}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {field('account_holder', 'Account holder name', 'As on the bank account')}
        {field('account_number', 'Account number', '123456789012', 'numeric')}
        {field('ifsc', 'IFSC', 'HDFC0001234')}
        {field('bank_name', 'Bank (optional)', 'HDFC Bank, Andheri')}
        {field('upi_id', 'UPI ID', 'name@okhdfcbank')}
      </div>
      {msg && <p className={`font-body-sm text-body-sm ${msg.ok ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            await onSave({ account_holder: b.account_holder, account_number: b.account_number, ifsc: b.ifsc, bank_name: b.bank_name, upi_id: b.upi_id });
            setMsg({ ok: true, text: 'Saved.' });
          } catch (e) {
            setMsg({ ok: false, text: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
        className="h-12 self-start px-6 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save payout details'}
      </button>
    </section>
  );
}

/** One-time ₹, monthly ₹, payout frequency and day — used when creating and editing a referrer. */
export function RatesFields({ value, onChange }: { value: ReferrerRates; onChange: (v: ReferrerRates) => void }) {
  const num = (label: string, key: 'one_time_inr' | 'monthly_inr', hint: string) => (
    <label className="flex flex-col gap-1">
      <span className="font-label-md text-label-md">{label}</span>
      <div className="flex items-center h-12 rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary/30">
        <span className="text-on-surface-variant mr-1">₹</span>
        <input
          inputMode="numeric"
          value={String(value[key])}
          onChange={(e) => onChange({ ...value, [key]: Number(e.target.value.replace(/\D/g, '') || 0) })}
          className="flex-1 bg-transparent font-body-lg text-body-lg focus:outline-none min-w-0"
        />
      </div>
      <span className="font-body-sm text-body-sm text-on-surface-variant">{hint}</span>
    </label>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {num('One-time per clinic', 'one_time_inr', 'When the clinic starts paying. 0 = none.')}
      {num('Every month per clinic', 'monthly_inr', 'While the clinic keeps paying. 0 = none.')}
      <label className="flex flex-col gap-1">
        <span className="font-label-md text-label-md">Pay them</span>
        <select
          value={value.payout_frequency}
          onChange={(e) => {
            const f = e.target.value as 'weekly' | 'monthly';
            onChange({ ...value, payout_frequency: f, payout_day: f === 'weekly' ? 1 : 5 });
          }}
          className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg"
        >
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-md text-label-md">{value.payout_frequency === 'weekly' ? 'On' : 'On day'}</span>
        <select
          value={value.payout_day}
          onChange={(e) => onChange({ ...value, payout_day: Number(e.target.value) })}
          className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg"
        >
          {value.payout_frequency === 'weekly'
            ? WEEKDAYS.slice(1).map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))
            : Array.from({ length: 28 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {ordinal(i + 1)} of the month
                </option>
              ))}
        </select>
      </label>
    </div>
  );
}

/** The referrer's login, shown once after create / reset, with a WhatsApp share (click-to-chat). */
export function LoginShareCard({ name, email, mobile, password, onClose }: { name: string; email: string; mobile: string | null; password: string; onClose: () => void }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/owner` : '/owner';
  const text = `Hi ${name}, your MedQR partner login:\n${url}\nEmail: ${email}\nPassword: ${password}\n\nAdd your clinics, doctors and reception logins there. Your rewards are under "My earnings".`;
  return (
    <section className="bg-tertiary-fixed/40 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Icon name="key" className="text-[24px] text-tertiary" />
        <div className="flex-1">
          <h2 className="font-headline-sm text-headline-sm">Login for {name}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Shown only now — share it, then close. You can reset it any time.</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 flex items-center justify-center text-on-surface-variant">
          <Icon name="close" className="text-[22px]" />
        </button>
      </div>
      <pre className="bg-surface-container-lowest rounded-xl p-3 font-body-md text-body-md whitespace-pre-wrap break-all">{text}</pre>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/${mobile ? `91${mobile}` : ''}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2"
        >
          <Icon name="chat" className="text-[20px]" /> Share on WhatsApp
        </a>
        <button onClick={() => navigator.clipboard?.writeText(text)} className="h-11 px-4 rounded-xl bg-surface-container-lowest text-primary font-label-lg text-label-lg flex items-center gap-2">
          <Icon name="content_copy" className="text-[20px]" /> Copy
        </button>
      </div>
    </section>
  );
}
