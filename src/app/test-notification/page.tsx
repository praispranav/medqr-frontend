'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPushToken, pushSupport, type PushSupport } from '@/lib/push';

export default function TestNotificationPage() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
    setSupport(pushSupport());
  }, []);

  const triggerLocalNotification = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      if (!('Notification' in window)) {
        throw new Error('This browser does not support desktop/mobile notifications.');
      }

      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }

      if (perm !== 'granted') {
        throw new Error('Notification permission was denied. Please allow notifications in site settings.');
      }

      new Notification('ClinicQ Test Notification 🔔', {
        body: 'Success! Web notifications are working properly on your browser.',
        icon: '/icons/192.png',
      });

      setStatusMsg('✓ Local notification displayed successfully!');
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const triggerServiceWorkerNotification = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers are not supported in this browser.');
      }

      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }

      if (perm !== 'granted') {
        throw new Error('Notification permission was denied. Please allow notifications in site settings.');
      }

      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      await reg.showNotification('ClinicQ Service Worker Alert', {
        body: "Token #12: It's your turn! Please proceed to Cabin 1.",
        tag: 'clinicq-test-alert',
        renotify: true,
        requireInteraction: true,
        data: { url: window.location.href },
      } as any);

      setStatusMsg('✓ Service worker notification triggered via /firebase-messaging-sw.js!');
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const testFirebaseToken = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setLoading(true);
    try {
      const token = await getPushToken();
      setFcmToken(token);
      setPermission(Notification.permission);
      setStatusMsg('✓ Firebase Cloud Messaging Token generated successfully!');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            ← Back to Home
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 px-6 py-5 text-white">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span>🔔</span> ClinicQ Push Notification Test
            </h1>
            <p className="text-emerald-100 text-sm mt-1">
              Test browser notifications, service workers, and Firebase Cloud Messaging directly.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* System Status Table */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Notification Permission:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    permission === 'granted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : permission === 'denied'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {permission}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Push API Support:</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  {support ?? 'checking...'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Service Worker:</span>
                <span className="text-xs text-slate-500 font-mono">/firebase-messaging-sw.js</span>
              </div>
            </div>

            {/* Test Actions */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Step 1: Test Local Alerts</h2>
              <button
                onClick={triggerLocalNotification}
                className="w-full py-3 px-4 bg-white border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 font-medium rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <span>💬</span> Test Simple Browser Notification
              </button>

              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 pt-2">
                Step 2: Test Service Worker Alert
              </h2>
              <button
                onClick={triggerServiceWorkerNotification}
                className="w-full py-3 px-4 bg-white border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 font-medium rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <span>⚙️</span> Test Service Worker Push (/firebase-messaging-sw.js)
              </button>

              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 pt-2">
                Step 3: Test Firebase Cloud Messaging
              </h2>
              <button
                disabled={loading}
                onClick={testFirebaseToken}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <span>🔥</span> {loading ? 'Registering Device with Firebase...' : 'Get Live Firebase FCM Token'}
              </button>
            </div>

            {/* Feedback Messages */}
            {statusMsg && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                {statusMsg}
              </div>
            )}

            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                <strong>Error:</strong> {errorMsg}
              </div>
            )}

            {/* FCM Token Display */}
            {fcmToken && (
              <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="font-semibold text-white">Your Firebase Device Token:</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(fcmToken);
                      setStatusMsg('✓ Token copied to clipboard!');
                    }}
                    className="text-emerald-400 hover:underline"
                  >
                    Copy Token
                  </button>
                </div>
                <p className="font-mono break-all bg-slate-800 p-2.5 rounded-lg border border-slate-700">{fcmToken}</p>
                <p className="text-[11px] text-slate-400">
                  This token confirms that Firebase Cloud Messaging is connected to your domain and active on this phone/computer.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
