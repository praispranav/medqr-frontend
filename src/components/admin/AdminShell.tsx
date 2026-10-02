'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { ADMIN_KEY_STORAGE, adminApi, readAdminKey, type AdminApi } from '@/lib/adminApi';
import { Icon, LoadingPage } from '@/components/patient/ui';

// Platform admin chrome (MedQR operators, not clinic staff). Until real auth exists the API is
// protected by ADMIN_API_KEY from backend/.env; the key is entered once and kept on this device.

const NAV = [
  { href: '/owner', label: 'Activity', icon: 'monitoring' },
  { href: '/owner/clinics', label: 'Clinics', icon: 'local_hospital' },
  { href: '/owner/leads', label: 'Trial requests', icon: 'inbox' },
  { href: '/owner/module-requests', label: 'Module requests', icon: 'extension' },
  { href: '/owner/qr-codes', label: 'QR codes', icon: 'qr_code_2' },
];

export function AdminShell({ active, children }: { active: string; children: (api: AdminApi) => ReactNode }) {
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const api = useMemo(() => (key ? adminApi(key) : null), [key]);

  useEffect(() => setKey(readAdminKey()), []);

  const signOut = () => {
    try {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
    } catch {
      /* ignore */
    }
    setKey(null);
  };

  if (key === undefined) return <LoadingPage />;
  if (!key || !api) return <KeyGate onOk={setKey} />;

  return (
    <div className="min-h-screen bg-surface text-on-surface lg:flex">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-inverse-surface text-white min-h-screen sticky top-0 h-screen p-4 gap-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center">
            <Icon name="admin_panel_settings" className="text-[22px]" />
          </div>
          <div>
            <p className="font-headline-sm text-headline-sm leading-tight">MedQR</p>
            <p className="font-label-sm text-label-sm uppercase opacity-70">Platform admin</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
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
            <Icon name="logout" className="text-[18px]" /> Lock admin
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-inverse-surface text-white px-4 h-14 flex items-center gap-3">
          <Icon name="admin_panel_settings" className="text-[22px]" />
          <span className="font-label-lg text-label-lg flex-1">MedQR admin</span>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`px-3 py-1.5 rounded-full font-label-md text-label-md ${active === n.href ? 'bg-primary-container' : 'opacity-80'}`}>
              {n.label}
            </Link>
          ))}
          <button onClick={signOut} aria-label="Lock admin"><Icon name="logout" className="text-[20px]" /></button>
        </header>
        <main className="p-4 lg:p-8 max-w-6xl">{children(api)}</main>
      </div>
    </div>
  );
}

function KeyGate({ onOk }: { onOk: (key: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const k = value.trim();
    if (!k) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi(k).ping();
      try {
        localStorage.setItem(ADMIN_KEY_STORAGE, k);
      } catch {
        /* session-only */
      }
      onOk(k);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach the backend on port 4000.");
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
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Enter the admin key — it&apos;s <code>ADMIN_API_KEY</code> in <code>backend/.env</code>.
          </p>
        </div>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Admin key"
          className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button disabled={busy} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  );
}
