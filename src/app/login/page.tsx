'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { HOME_FOR_ROLE } from '@/lib/staffRoutes';
import { Icon, LoadingPage } from '@/components/patient/ui';

// Staff login. Reception and doctors have separate accounts (created in /admin); the role decides
// where you land and which screens the server lets you use.

const LAST_CLINIC_KEY = 'medqr:last-clinic';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [clinic, setClinic] = useState(params.get('clinic') ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!params.get('clinic')) {
      try {
        setClinic(localStorage.getItem(LAST_CLINIC_KEY) ?? '');
      } catch {
        /* ignore */
      }
    }
  }, [params]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const me = await api.login({ clinic: clinic.trim(), username: username.trim(), password });
      try {
        localStorage.setItem(LAST_CLINIC_KEY, me.tenant.subdomain);
      } catch {
        /* ignore */
      }
      const next = params.get('next');
      // Only follow ?next= to a same-site path the role can actually use.
      const allowed = me.user.role === 'doctor' ? ['/doctor/', '/q/'] : ['/reception'];
      router.replace(next && allowed.some((a) => next.startsWith(a)) ? next : HOME_FOR_ROLE[me.user.role]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach MedQR. Check your connection.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4"
      >
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
            <Icon name="qr_code_2" className="text-[24px]" />
          </span>
          <span className="font-headline-sm text-headline-sm text-primary">MedQR</span>
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Doctor/Staff Login</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">For reception and doctors. Patients don&apos;t need to log in.</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Clinic code</span>
          <div className="flex items-center bg-surface-container-low rounded-xl px-3 h-12 focus-within:ring-2 focus-within:ring-primary/30">
            <input
              value={clinic}
              onChange={(e) => setClinic(e.target.value.toLowerCase())}
              autoCapitalize="none"
              placeholder="drkumar"
              className="flex-1 min-w-0 bg-transparent font-body-lg text-body-lg focus:outline-none"
            />
            <span className="font-body-md text-body-md text-on-surface-variant">.medqr.in</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Username</span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoCapitalize="none"
            autoComplete="username"
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button
          disabled={busy || !clinic.trim() || !username.trim() || !password}
          className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg disabled:opacity-40"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="font-body-sm text-body-sm text-outline">Forgot your password? Ask MedQR support to reset it.</p>
      </form>
    </main>
  );
}
