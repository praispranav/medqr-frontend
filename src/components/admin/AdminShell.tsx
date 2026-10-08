'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { ADMIN_KEY_STORAGE, adminApi, platformAuth, type AdminApi, type PlatformAdminMe } from '@/lib/adminApi';
import { Icon, LoadingPage } from '@/components/patient/ui';

// Platform admin chrome (MedQR operators, not clinic staff). Sign in with email + password; the
// session is an httpOnly cookie (12 hours). Super admin accounts are created on the server with
// `npm run admin:create -- <email>` — there's no sign-up page. Referral partners (Decision 27) are
// created in Owner › Referrers and get a cut-down panel: their clinics + My earnings.

const NAV = [
  { href: '/owner', label: 'Activity', icon: 'monitoring' },
  { href: '/owner/clinics', label: 'Clinics', icon: 'local_hospital' },
  { href: '/owner/referrers', label: 'Referrers', icon: 'handshake' },
  { href: '/owner/coupons', label: 'Coupons', icon: 'sell' },
  { href: '/owner/leads', label: 'Trial requests', icon: 'inbox' },
  { href: '/owner/module-requests', label: 'Module requests', icon: 'extension' },
  { href: '/owner/setting-requests', label: 'Setting requests', icon: 'auto_awesome' },
  { href: '/owner/qr-codes', label: 'QR codes', icon: 'qr_code_2' },
];

const REFERRER_NAV = [
  { href: '/owner/clinics', label: 'My clinics', icon: 'local_hospital' },
  { href: '/owner/earnings', label: 'My earnings', icon: 'payments' },
];

export function AdminShell({ active, children }: { active: string; children: (api: AdminApi, me: PlatformAdminMe) => ReactNode }) {
  // undefined = checking, null = signed out
  const [me, setMe] = useState<PlatformAdminMe | null | undefined>(undefined);
  const api = useMemo(() => adminApi(''), []);

  useEffect(() => {
    platformAuth
      .me()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const signOut = async () => {
    await platformAuth.logout().catch(() => undefined);
    setMe(null);
  };

  if (me === undefined) return <LoadingPage />;
  if (!me) return <SignIn onOk={setMe} />;

  const referrer = me.role === 'referrer';
  const nav = referrer ? REFERRER_NAV : NAV;
  // A referrer on a super-admin page (bookmark, old link) goes to their clinics instead.
  if (referrer && !nav.some((n) => n.href === active)) {
    if (typeof window !== 'undefined') window.location.replace('/owner/clinics');
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface lg:flex">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-inverse-surface text-white min-h-screen sticky top-0 h-screen p-4 gap-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center">
            <Icon name="admin_panel_settings" className="text-[22px]" />
          </div>
          <div>
            <p className="font-headline-sm text-headline-sm leading-tight">MedQR</p>
            <p className="font-label-sm text-label-sm uppercase opacity-70">{referrer ? 'Referral partner' : 'Platform admin'}</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-label-lg text-label-lg ${
                active === n.href ? 'bg-primary-container' : 'opacity-80 hover:bg-white/10 hover:opacity-100'
              }`}
            >
              <Icon name={n.icon} className="text-[20px]" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-xl opacity-80 hover:bg-white/10 font-label-md text-label-md">
            <Icon name="home" className="text-[18px]" /> Website
          </Link>
          <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 rounded-xl opacity-80 hover:bg-white/10 font-label-md text-label-md text-left">
            <Icon name="logout" className="text-[18px]" /> Sign out
          </button>
          <p className="px-3 font-body-sm text-body-sm opacity-60 truncate">{me.email}</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-inverse-surface text-white px-4 h-14 flex items-center gap-3">
          <Icon name="admin_panel_settings" className="text-[22px]" />
          <span className="font-label-lg text-label-lg flex-1">{referrer ? 'MedQR partner' : 'MedQR admin'}</span>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`px-3 py-1.5 rounded-full font-label-md text-label-md ${active === n.href ? 'bg-primary-container' : 'opacity-80'}`}>
              {n.label}
            </Link>
          ))}
          <button onClick={signOut} aria-label="Sign out"><Icon name="logout" className="text-[20px]" /></button>
        </header>
        <main className="p-4 lg:p-8 max-w-6xl">{children(api, me)}</main>
      </div>
    </div>
  );
}

function SignIn({ onOk }: { onOk: (me: PlatformAdminMe) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const me = await platformAuth.login(email.trim(), password);
      try {
        localStorage.removeItem(ADMIN_KEY_STORAGE); // the old key login isn't used any more
      } catch {
        /* ignore */
      }
      onOk(me);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach the MedQR server.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-inverse-surface p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 shadow-xl flex flex-col gap-4"
      >
        <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
          <Icon name="admin_panel_settings" className="text-[26px]" />
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md">MedQR platform admin</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Sign in to manage clinics, QR codes and modules.</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Email</span>
          <input
            autoFocus
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button disabled={busy || !email.trim() || !password} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
