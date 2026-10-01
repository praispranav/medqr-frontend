'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, type Me } from '@/lib/api';
import { HOME_FOR_ROLE } from '@/lib/staffRoutes';
import { Icon, LoadingPage } from '@/components/patient/ui';

// Decision 15: every staff password is admin-generated (creation) or admin-reset — never typed by
// the admin. Whoever gets one lands here, whether forced (must_change_password) or just changing it
// by choice from their account menu.

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <ChangePasswordForm />
    </Suspense>
  );
}

function ChangePasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then(setMe).catch((e) => {
      if (e instanceof ApiError && e.status === 401) router.replace('/login');
      else setFailed(true);
    });
  }, [router]);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    router.replace('/login');
  };

  const submit = async () => {
    if (newPassword !== confirm) {
      setError('New password and confirmation don’t match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.changePassword({ currentPassword, newPassword });
      const next = params.get('next');
      router.replace(next && next.startsWith('/') ? next : HOME_FOR_ROLE[updated.user.role]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach MedQR. Check your connection.");
      setBusy(false);
    }
  };

  if (failed)
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-headline-md text-headline-md">Can&apos;t reach MedQR</p>
        <p className="font-body-md text-body-md text-on-surface-variant">Check the connection and reload the page.</p>
      </main>
    );
  if (!me) return <LoadingPage />;

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
            <Icon name="lock_reset" className="text-[24px]" />
          </span>
          <span className="font-headline-sm text-headline-sm text-primary">MedQR</span>
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">
            {me.user.must_change_password ? 'Set your password' : 'Change your password'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {me.user.must_change_password
              ? `Hi ${me.user.name}, your password was set for you. Choose one only you know before you continue.`
              : `Hi ${me.user.name}, choose a new password below.`}
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">{me.user.must_change_password ? 'Temporary password' : 'Current password'}</span>
          <input
            type="password"
            autoFocus
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">New password (min 8)</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">Confirm new password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="h-12 rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <button
          disabled={busy || !currentPassword || newPassword.length < 8 || !confirm}
          className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save password'}
        </button>
        <button type="button" onClick={logout} className="font-label-md text-label-md text-on-surface-variant">
          Log out instead
        </button>
      </form>
    </main>
  );
}
