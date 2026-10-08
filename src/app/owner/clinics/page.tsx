'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdminApi, AdminTenant, Coupon } from '@/lib/adminApi';
import { describeCoupon } from '@/lib/coupons';
import { Icon } from '@/components/patient/ui';
import { AdminShell } from '@/components/admin/AdminShell';
import { inr } from '@/components/staff/bits';

export default function AdminClinicsPage() {
  return <AdminShell active="/owner/clinics">{(api, me) => <Clinics api={api} referrer={me.role === 'referrer'} />}</AdminShell>;
}

function Clinics({ api, referrer }: { api: AdminApi; referrer: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<AdminTenant[] | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  // Decision 36: optional coupon. Referrers pick from the codes issued to them; super admin types any.
  const [coupon, setCoupon] = useState('');
  const [myCoupons, setMyCoupons] = useState<Coupon[]>([]);
  useEffect(() => {
    if (referrer) api.myCoupons().then(setMyCoupons).catch(() => undefined);
  }, [api, referrer]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.tenants().then(setList).catch((e: Error) => setError(e.message));
  }, [api]);

  // Suggest a clinic code from the name until the admin edits it themselves.
  const suggested = name
    .toLowerCase()
    .replace(/^dr\.?\s+/, 'dr')
    .replace(/'s\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);
  const effectiveCode = codeTouched ? code : suggested;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const t = await api.createTenant({ subdomain: effectiveCode, display_name: name, city: city.trim() || undefined, address: address.trim() || undefined, coupon_code: coupon || undefined });
      router.push(`/owner/clinics/${t.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline-lg text-headline-lg">Clinics</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4"
      >
        <h2 className="font-headline-sm text-headline-sm">Add a clinic</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Clinic name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Sharma's Child Clinic"
              className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Clinic code (web address)</span>
            <div className="flex items-center h-12 rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary/30">
              <input
                value={effectiveCode}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                }}
                placeholder="drsharma"
                className="flex-1 min-w-0 bg-transparent font-body-lg text-body-lg focus:outline-none"
              />
              <span className="font-body-md text-body-md text-on-surface-variant">.medqr.in</span>
            </div>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">City (optional)</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Trivandrum"
              className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-md text-label-md">Address (optional)</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="2nd Floor, MG Road"
              className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant -mt-1">
          Used for the public doctor directory (medqr.in/doctors) — doctors there share the clinic&apos;s own address, so there&apos;s no separate address per doctor.
        </p>
        <label className="flex flex-col gap-1 max-w-md">
          <span className="font-label-md text-label-md">Coupon (optional)</span>
          {referrer ? (
            <select value={coupon} onChange={(e) => setCoupon(e.target.value)} className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg">
              <option value="">No coupon</option>
              {myCoupons.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} — {describeCoupon(c)}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              placeholder="e.g. DOCTOR40"
              className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
        </label>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button disabled={busy || !name.trim() || !effectiveCode} className="self-start h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40">
          {busy ? 'Creating…' : 'Create clinic'}
        </button>
      </form>

      <section className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        {list === null && !error && <p className="p-5 font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        {list?.length === 0 && <p className="p-5 font-body-md text-body-md text-on-surface-variant">No clinics yet — add the first one above.</p>}
        {list?.map((t) => (
          <Link key={t.id} href={`/owner/clinics/${t.id}`} className="flex items-center gap-4 px-5 py-4 border-b border-surface-container last:border-0 hover:bg-surface-container-low">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed/50 text-primary flex items-center justify-center shrink-0">
              <Icon name="local_hospital" className="text-[22px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-label-lg text-label-lg truncate">{t.display_name ?? t.subdomain}</p>
                {t.subscription && (
                  <span
                    className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm shrink-0 ${
                      t.subscription.status === 'read_only'
                        ? 'bg-error text-white'
                        : t.subscription.status === 'grace'
                          ? 'bg-secondary text-white'
                          : t.subscription.status === 'trial'
                            ? 'bg-blue-600 text-white'
                            : 'bg-tertiary text-white'
                    }`}
                  >
                    {t.subscription.status === 'trial' ? 'Free Trial' : t.subscription.status === 'grace' ? 'Grace' : t.subscription.status === 'read_only' ? 'Read-only' : 'Paid'}
                  </span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{t.subdomain}.medqr.in</p>
            </div>
            <div className="hidden sm:flex gap-6 font-body-sm text-body-sm text-on-surface-variant text-right">
              <p><strong className="block text-on-surface font-label-lg text-label-lg">{t.doctor_count}</strong>doctors</p>
              <p><strong className="block text-on-surface font-label-lg text-label-lg">{t.tokens_today}</strong>tokens today</p>
              <p><strong className="block text-on-surface font-label-lg text-label-lg">{inr(t.wallet_balance_inr)}</strong>wallet</p>
            </div>
            <Icon name="chevron_right" className="text-on-surface-variant" />
          </Link>
        ))}
        {list?.length === 0 && <p className="p-5 font-body-md text-body-md text-on-surface-variant">No clinics yet — add the first one above.</p>}
      </section>
    </div>
  );
}
