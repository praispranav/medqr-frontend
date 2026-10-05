'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { getPushToken, pushSupport, type PushSupport } from '@/lib/push';
import { OPEN_A2HS_EVENT } from '@/lib/homeScreen';

// "Alert me when it's my turn" — Firebase web push for this token: one alert when the patient is
// next, one when the doctor calls them (free; works with the screen locked). Hidden when the
// server hasn't got Firebase set up or this browser can't do push.
export function PushAlertCard({ tokenId, enabled, onChange }: { tokenId: string; enabled: boolean; onChange: () => void }) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSupport(pushSupport()), []);
  if (!support || support === 'not_configured' || support === 'unsupported') return null;

  if (enabled) {
    return (
      <div className="w-full bg-tertiary-fixed/40 rounded-2xl px-4 py-3 flex items-center gap-3">
        <Icon name="notifications_active" className="text-[22px] text-tertiary" />
        <p className="flex-1 font-body-md text-body-md text-on-surface">Alerts on — we&apos;ll notify you when you&apos;re next and when it&apos;s your turn.</p>
        <button
          onClick={async () => {
            await api.setTokenPush(tokenId, null).catch(() => undefined);
            onChange();
          }}
          className="min-h-[44px] px-2 font-label-md text-label-md text-on-surface-variant"
        >
          Turn off
        </button>
      </div>
    );
  }

  if (support === 'ios_needs_home_screen') {
    return (
      <button
        onClick={() => window.dispatchEvent(new Event(OPEN_A2HS_EVENT))}
        className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left"
      >
        <Icon name="notifications" className="text-[22px] text-primary" />
        <span className="flex-1 font-body-sm text-body-sm text-on-surface-variant">
          <strong className="text-on-surface">Want an alert when it&apos;s your turn?</strong> Add MedQR to your Home Screen first.
        </span>
        <Icon name="chevron_right" className="text-[22px] text-on-surface-variant" />
      </button>
    );
  }

  if (support === 'denied') {
    return (
      <p className="w-full font-body-sm text-body-sm text-on-surface-variant text-center">
        Notifications are blocked for this site — allow them in your browser settings to get turn alerts.
      </p>
    );
  }

  return (
    <div className="w-full flex flex-col gap-1.5">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api.setTokenPush(tokenId, await getPushToken());
            onChange();
          } catch (e) {
            setError((e as Error).message);
            setSupport(pushSupport());
          } finally {
            setBusy(false);
          }
        }}
        className="w-full h-12 bg-surface-container-lowest text-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
      >
        <Icon name={busy ? 'progress_activity' : 'notifications'} className={`text-[20px] ${busy ? 'animate-spin' : ''}`} />
        Alert me when it&apos;s my turn
      </button>
      {error && <p className="font-body-sm text-body-sm text-error text-center">{error}</p>}
    </div>
  );
}
