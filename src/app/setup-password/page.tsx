'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Icon, LoadingPage } from '@/components/patient/ui';

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <SetupPasswordForm />
    </Suspense>
  );
}

function SetupPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-headline-md text-headline-md">Invalid Link</p>
        <p className="font-body-md text-body-md text-on-surface-variant">The setup link is missing or invalid. Please check the URL.</p>
      </main>
    );
  }

  const submit = async () => {
    if (newPassword !== confirm) {
      setError('New password and confirmation don’t match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.setupPassword({ token, newPassword });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Can't reach MedQR. Check your connection.");
      setBusy(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface p-4 text-center">
        <span className="w-16 h-16 rounded-full bg-primary-container text-on-primary flex items-center justify-center">
          <Icon name="check_circle" className="text-[32px]" />
        </span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Password Set Successfully</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
          Your MedQR account is ready. You can now log in using your clinic code and new password.
        </p>
        <button
          onClick={() => router.replace('/login')}
          className="mt-2 h-12 px-6 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg"
        >
          Go to Login
        </button>
      </main>
    );
  }

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
            <Icon name="lock" className="text-[24px]" />
          </span>
          <span className="font-headline-sm text-headline-sm text-primary">MedQR</span>
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Set your password</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Choose a strong password for your new MedQR staff account.
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-label-md text-label-md">New password (min 8)</span>
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
          disabled={busy || newPassword.length < 8 || !confirm}
          className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </main>
  );
}
