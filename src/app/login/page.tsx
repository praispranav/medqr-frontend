'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { HOME_FOR_ROLE } from '@/lib/staffRoutes';
import { clinicFromHost, ROOT_DOMAIN } from '@/lib/clinicHost';
import { Icon, LoadingPage } from '@/components/patient/ui';

// Staff login. Reception and doctors have separate accounts (created in /admin); the role decides
// where you land and which screens the server lets you use.
// Clinic code: opened on a clinic's own subdomain (drkumar.medqr.in/login) we move to the main
// domain's /login?clinic=drkumar — staff screens and the session cookie live there, and a cookie
// set from a clinic subdomain isn't reliably sent (never locally: drkumar.localhost ≠ localhost).
// With ?clinic= naming a real clinic, the code is filled in and the field is hidden.

const LAST_CLINIC_KEY = 'medqr:last-clinic';
const RECENT_CLINICS_KEY = 'medqr:recent-clinics';
const MAX_RECENT_CLINICS = 5;

function loadRecentClinics(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_CLINICS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

function rememberClinic(code: string) {
  try {
    const rest = loadRecentClinics().filter((c) => c !== code);
    localStorage.setItem(RECENT_CLINICS_KEY, JSON.stringify([code, ...rest].slice(0, MAX_RECENT_CLINICS)));
  } catch {
    /* ignore */
  }
}

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
  const [recentClinics, setRecentClinics] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const usernameRef = useRef<HTMLInputElement>(null);
  // Set when the page is on a clinic subdomain that really exists; the code field is then hidden.
  const [hostClinic, setHostClinic] = useState<{
    code: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const fromHost = clinicFromHost(window.location.host);
    if (fromHost) {
      const main = new URL(window.location.href);
      main.hostname = ROOT_DOMAIN;
      main.searchParams.set('clinic', fromHost);
      window.location.replace(main.toString());
      return;
    }
    const code = (params.get('clinic') ?? '').trim().toLowerCase();
    if (!code) return;
    api
      .getTenantBySubdomain(code)
      .then((t) => {
        if (!t) return;
        setClinic(code);
        setHostClinic({ code, name: t.display_name ?? code });
      })
      .catch(() => undefined); // unknown clinic or offline: just show the normal field
  }, [params]);

  useEffect(() => {
    setRecentClinics(loadRecentClinics());
    if (!params.get('clinic') && !clinicFromHost(window.location.host)) {
      try {
        setClinic(localStorage.getItem(LAST_CLINIC_KEY) ?? '');
      } catch {
        /* ignore */
      }
    }
  }, [params]);

  const suggestions = useMemo(() => {
    const typed = clinic.trim();
    return recentClinics.filter((c) => c !== typed && c.startsWith(typed)).slice(0, MAX_RECENT_CLINICS);
  }, [clinic, recentClinics]);

  const pickSuggestion = (code: string) => {
    setClinic(code);
    setShowSuggestions(false);
    usernameRef.current?.focus();
    try {
      localStorage.setItem(LAST_CLINIC_KEY, code);
    } catch {
      /* ignore */
    }
    rememberClinic(code);
    setRecentClinics(loadRecentClinics());
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const me = await api.login({
        clinic: clinic.trim(),
        username: username.trim(),
        password,
      });
      try {
        localStorage.setItem(LAST_CLINIC_KEY, me.tenant.subdomain);
      } catch {
        /* ignore */
      }
      rememberClinic(me.tenant.subdomain);
      // Decision 15: a random or just-reset password must be changed before anything else.
      if (me.user.must_change_password) {
        router.replace(`/change-password?next=${encodeURIComponent(params.get('next') ?? HOME_FOR_ROLE[me.user.role])}`);
        return;
      }
      const next = params.get('next');
      // Only follow ?next= to a same-site path the role can actually use.
      const allowed =
        me.user.role === 'doctor'
          ? ['/doctor/', '/q/', ...(me.user.is_owner ? ['/manage'] : [])]
          : me.user.role === 'owner'
            ? ['/manage']
            : ['/reception'];
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
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            For reception and doctors. Patients don&apos;t need to log in.
          </p>
        </div>

        {hostClinic ? (
          <div className="flex items-center gap-3 bg-surface-container-low rounded-xl px-3 py-2.5">
            <Icon name="local_hospital" className="text-[22px] text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-label-lg text-label-lg text-on-surface truncate">{hostClinic.name}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">Clinic code: {hostClinic.code}</p>
            </div>
            <button type="button" onClick={() => setHostClinic(null)} className="font-label-md text-label-md text-primary shrink-0">
              Change
            </button>
          </div>
        ) : (
          <label className="flex flex-col gap-1 relative">
            <span className="font-label-md text-label-md">Clinic code</span>
            <div className="flex items-center bg-surface-container-low rounded-xl px-3 h-12 focus-within:ring-2 focus-within:ring-primary/30">
              <input
                value={clinic}
                onChange={(e) => {
                  setClinic(e.target.value.toLowerCase());
                  setShowSuggestions(true);
                  setHighlighted(0);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                onKeyDown={(e) => {
                  if (!showSuggestions || suggestions.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlighted((i) => (i + 1) % suggestions.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlighted((i) => (i - 1 + suggestions.length) % suggestions.length);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    pickSuggestion(suggestions[highlighted]);
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                placeholder="drkumar"
                role="combobox"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-autocomplete="list"
                className="flex-1 min-w-0 bg-transparent font-body-lg text-body-lg focus:outline-none"
              />
              <span className="font-body-md text-body-md text-on-surface-variant">.medqr.in</span>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-10 bg-surface-container-lowest rounded-xl shadow-md overflow-hidden border border-surface-container-low">
                {suggestions.map((code, i) => (
                  <li key={code}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(code)}
                      className={`w-full text-left px-3 min-h-11 flex items-center gap-2 font-body-lg text-body-lg ${
                        i === highlighted ? 'bg-surface-container-low' : ''
                      }`}
                    >
                      <Icon name="history" className="text-[18px] text-on-surface-variant" />
                      {code}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Username</span>
          <input
            ref={usernameRef}
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
