'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, type LoginChoice, type Me } from '@/lib/api';
import { HOME_FOR_ROLE, homeFor } from '@/lib/staffRoutes';
import { apiBase, clinicFromHost, rootOf, ROOT_DOMAIN } from '@/lib/clinicHost';
import { useHost } from '@/lib/useHost';
import { Icon, LoadingPage } from '@/components/patient/ui';

// Staff login. Reception and doctors have separate accounts (created in /admin); the role decides
// where you land and which screens the server lets you use.
// Clinic code (Decision 56): opened on a clinic's own subdomain (drkumar.clinicq.fit/login) the code
// comes from the address and the field is hidden — staff stay on their clinic's address, because the
// API (api.clinicq.fit) is the same site, so its session cookie is sent from there too. When the API
// is on another site (locally: drkumar.localhost ≠ localhost) we still move to the main domain's
// /login?clinic=drkumar instead. With ?clinic= naming a real clinic, the field is hidden as well.

/** True when the API this page calls shares its root domain (api.clinicq.in from drkumar.clinicq.in). */
function apiIsSameSite() {
  const root = rootOf(window.location.host);
  if (!root || root === 'localhost') return false;
  try {
    const h = new URL(apiBase()).hostname.toLowerCase();
    return h === root || h.endsWith(`.${root}`);
  } catch {
    return false;
  }
}

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
  const [username, setUsername] = useState((params.get('username') ?? '').toLowerCase()); // set-password page links here prefilled
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recentClinics, setRecentClinics] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const usernameRef = useRef<HTMLInputElement>(null);
  const host = useHost();
  const visitorRoot = rootOf(host);
  const codeSuffix = visitorRoot && visitorRoot !== 'localhost' ? visitorRoot : ROOT_DOMAIN === 'localhost' ? 'clinicq.fit' : ROOT_DOMAIN;
  // Set when the page is on a clinic subdomain that really exists; the code field is then hidden.
  const [hostClinic, setHostClinic] = useState<{
    code: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const fromHost = clinicFromHost(window.location.host);
    if (fromHost && apiIsSameSite()) {
      api
        .getTenantBySubdomain(fromHost)
        .then((t) => {
          if (!t) return;
          setClinic(fromHost);
          setHostClinic({ code: fromHost, name: t.display_name ?? fromHost });
        })
        .catch(() => setClinic(fromHost));
      return;
    }
    if (fromHost) {
      const main = new URL(window.location.href);
      main.hostname = rootOf(window.location.host) ?? ROOT_DOMAIN;
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

  // Decision 67: sign in with username or mobile + password, or a WhatsApp code; no clinic code needed.
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [forgot, setForgot] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [choices, setChoices] = useState<LoginChoice['choose'] | null>(null);

  const finish = (me: Me) => {
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
    router.replace(next && allowed.some((a) => next.startsWith(a)) ? next : homeFor(me));
  };

  const run = async (fn: () => Promise<Me | LoginChoice>) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if ('choose' in r) {
        setChoices(r.choose);
        setBusy(false);
        return;
      }
      finish(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach ClinicQ. Check your connection.");
      setBusy(false);
    }
  };

  const submit = (userId?: string) =>
    mode === 'password'
      ? run(() => api.login({ clinic: hostClinic?.code, username: username.trim(), password, user_id: userId }))
      : run(() => api.staffOtpVerify({ mobile: username.trim(), code, user_id: userId, forgot }));

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.staffOtpStart(username.trim());
      setCodeSent(true);
      if (r.dev_code) setCode(r.dev_code);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach ClinicQ. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const field = 'h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30';

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
          <span className="font-headline-sm text-headline-sm text-primary">ClinicQ</span>
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Doctor/Staff Login</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            For reception and doctors. Patients don&apos;t need to log in.
          </p>
        </div>

        {hostClinic && (
          <div className="flex items-center gap-3 bg-surface-container-low rounded-xl px-3 py-2.5">
            <Icon name="local_hospital" className="text-[22px] text-primary" />
            <p className="flex-1 min-w-0 font-label-lg text-label-lg text-on-surface truncate">{hostClinic.name}</p>
          </div>
        )}

        {choices ? (
          <div className="flex flex-col gap-2">
            <p className="font-label-lg text-label-lg">Which clinic?</p>
            {choices.map((c) => (
              <button
                key={c.user_id}
                type="button"
                disabled={busy}
                onClick={() => submit(c.user_id)}
                className="text-left rounded-xl bg-surface-container-low px-3 py-3 flex items-center gap-3 hover:bg-surface-container disabled:opacity-50"
              >
                <Icon name="local_hospital" className="text-[22px] text-primary" />
                <span className="flex-1 min-w-0">
                  <span className="block font-label-lg text-label-lg truncate">{c.clinic_name}</span>
                  <span className="block font-body-sm text-body-sm text-on-surface-variant capitalize">{c.name} · {c.role}</span>
                </span>
                <Icon name="chevron_right" className="text-on-surface-variant" />
              </button>
            ))}
            <button type="button" onClick={() => setChoices(null)} className="font-label-md text-label-md text-primary self-start">Back</button>
          </div>
        ) : (
          <>
            {forgot && <p className="font-body-md text-body-md text-on-surface-variant">We&apos;ll send a code to your mobile on WhatsApp. After signing in you&apos;ll set a new password.</p>}
            <label className="flex flex-col gap-1">
              <span className="font-label-md text-label-md">{mode === 'code' ? 'Mobile number' : 'Username or mobile number'}</span>
              <input
                ref={usernameRef}
                autoFocus={!params.get('username')}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase());
                  setCodeSent(false);
                }}
                autoCapitalize="none"
                autoComplete="username"
                inputMode={mode === 'code' ? 'tel' : 'text'}
                placeholder={mode === 'code' ? '10-digit mobile' : 'e.g. ravi or 98765 43210'}
                className={field}
              />
            </label>
            {mode === 'password' ? (
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md">Password</span>
                <input type="password" autoFocus={!!params.get('username')} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={field} />
              </label>
            ) : codeSent ? (
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md">Code from WhatsApp</span>
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits" className={field} />
              </label>
            ) : null}
            {error && <p className="font-body-sm text-body-sm text-error">{error}{error.startsWith('No staff login') && <> <a href="/signin" className="text-primary underline">Go to Sign in</a></>}</p>}
            {mode === 'code' && !codeSent ? (
              <button type="button" onClick={sendCode} disabled={busy || username.replace(/\D/g, '').length < 10} className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg disabled:opacity-40">
                {busy ? 'Sending…' : 'Send code on WhatsApp'}
              </button>
            ) : (
              <button
                disabled={busy || !username.trim() || (mode === 'password' ? !password : code.length !== 6)}
                className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg disabled:opacity-40"
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            )}
            <div className="flex flex-wrap justify-between gap-2 font-label-md text-label-md">
              <button type="button" className="text-primary" onClick={() => { setMode(mode === 'password' ? 'code' : 'password'); setForgot(false); setCodeSent(false); setError(null); }}>
                {mode === 'password' ? 'Sign in with WhatsApp code' : 'Sign in with password'}
              </button>
              {mode === 'password' && (
                <button type="button" className="text-on-surface-variant" onClick={() => { setMode('code'); setForgot(true); setCodeSent(false); setError(null); }}>
                  Forgot password?
                </button>
              )}
            </div>
          </>
        )}
      </form>
    </main>
  );
}
