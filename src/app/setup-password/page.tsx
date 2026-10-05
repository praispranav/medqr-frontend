'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { api, ApiError, type LoginHints, type SetupInfo, type StaffRole } from '@/lib/api';
import { Icon, LoadingPage } from '@/components/patient/ui';

// Decision 15: the link an admin shares after creating a login or resetting a password. Shows
// whose account it is (name, username, clinic + clinic code), lets them set a password once, then
// walks them through logging in — with a button that opens /login already filled in.

const ROLE_LABEL: Record<StaffRole, string> = { doctor: 'Doctor', reception: 'Reception', owner: 'Clinic admin' };

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <SetupPassword />
    </Suspense>
  );
}

function loginHref(h: LoginHints) {
  return `/login?clinic=${encodeURIComponent(h.clinic_code)}&username=${encodeURIComponent(h.username)}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
            <Icon name="lock" className="text-[24px]" />
          </span>
          <span className="font-headline-sm text-headline-sm text-primary">MedQR</span>
        </div>
        {children}
      </div>
    </main>
  );
}

/** The three things they type on the login page, spelled out. */
function LoginSteps({ hints }: { hints: LoginHints }) {
  const site = typeof window !== 'undefined' ? window.location.host : '';
  return (
    <ol className="flex flex-col gap-2 bg-surface-container-low rounded-xl p-4 font-body-md text-body-md text-on-surface">
      <li>
        <span className="font-label-md text-label-md text-on-surface-variant">1. Open</span> <strong>{site}/login</strong>
      </li>
      <li>
        <span className="font-label-md text-label-md text-on-surface-variant">2. Clinic code:</span> <strong>{hints.clinic_code}</strong>
      </li>
      <li>
        <span className="font-label-md text-label-md text-on-surface-variant">3. Username:</span> <strong>{hints.username}</strong>
      </li>
      <li>
        <span className="font-label-md text-label-md text-on-surface-variant">4. Password:</span> the one you set here
      </li>
    </ol>
  );
}

function SetupPassword() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<LoginHints | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    setToken(t);
    if (t) api.setupInfo(t).then(setInfo).catch(() => setLoadError(true));
  }, []);

  if (token === undefined || (token && !info && !loadError)) return <LoadingPage />;

  if (!token || loadError || (info && !info.valid && info.reason === 'expired')) {
    return (
      <Shell>
        <h1 className="font-headline-md text-headline-md text-on-surface">This link has expired</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Password links work for 24 hours. Ask your clinic admin to send you a new one.
        </p>
      </Shell>
    );
  }

  if (done || (info && !info.valid && info.reason === 'used')) {
    const hints = done ?? (info as LoginHints);
    return (
      <Shell>
        <div className="flex items-center gap-2 text-tertiary">
          <Icon name="check_circle" className="text-[28px]" />
          <h1 className="font-headline-md text-headline-md text-on-surface">{done ? 'Password set' : 'Password already set'}</h1>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {done ? 'You can log in now.' : 'This link was already used. Log in with your password.'} Here&apos;s how:
        </p>
        <LoginSteps hints={hints} />
        <Link href={loginHref(hints)} className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2">
          <Icon name="login" className="text-[20px]" /> Log in now
        </Link>
        <p className="font-body-sm text-body-sm text-on-surface-variant">The button fills in the clinic code and username for you. Bookmark the login page for next time.</p>
      </Shell>
    );
  }

  const valid = info as Extract<SetupInfo, { valid: true }>;

  const submit = async () => {
    if (newPassword !== confirm) {
      setError('The two passwords don’t match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.setupPassword({ token, newPassword });
      setDone({ username: res.username, clinic_code: res.clinic_code, clinic_name: res.clinic_name });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach MedQR. Check your connection.");
      setBusy(false);
    }
  };

  return (
    <Shell>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Set your password</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Hello {valid.name}, choose a password for your MedQR login.</p>
        </div>

        <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 font-body-md text-body-md">
          <p className="font-label-lg text-label-lg text-on-surface">{valid.clinic_name}</p>
          <p className="text-on-surface-variant">
            Clinic code: <strong className="text-on-surface">{valid.clinic_code}</strong>
          </p>
          <p className="text-on-surface-variant">
            Username: <strong className="text-on-surface">{valid.username}</strong> · {ROLE_LABEL[valid.role]}
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">New password (min 8 characters)</span>
          <input
            type="password"
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Type it again</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        {/* Lets password managers save it against the right username. */}
        <input type="text" name="username" autoComplete="username" value={valid.username} readOnly hidden />
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button disabled={busy || newPassword.length < 8 || !confirm} className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg disabled:opacity-40">
          {busy ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </Shell>
  );
}
