'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import {
  HANDOFF_PARAM,
  OPEN_A2HS_EVENT,
  canPromptInstall,
  catchInstallPrompt,
  createHandoff,
  isAndroid,
  isIos,
  isStandalone,
  markDismissed,
  promptInstall,
  recentlyDismissed,
  redeemHandoff,
} from '@/lib/homeScreen';

const FINISHED = new Set(['done', 'no_show', 'expired', 'cancelled']);
let bridged = false;

/**
 * Mounted on every patient page (layout). Browser tab: catches Chrome's install prompt. Home Screen
 * app opened from its icon: redeems the one-time hand-off code (first launch) and, if the token it
 * was added from is finished, opens the clinic page instead of a stale token.
 */
export function HomeScreenBridge() {
  const router = useRouter();
  useEffect(() => {
    if (bridged) return;
    bridged = true;
    if (!isStandalone()) {
      catchInstallPrompt();
      return;
    }
    const url = new URL(window.location.href);
    const code = url.searchParams.get(HANDOFF_PARAM);
    if (!code) return;
    url.searchParams.delete(HANDOFF_PARAM);
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
    (async () => {
      await redeemHandoff(code).catch(() => null); // used already → the keys are here from the first launch
      const m = url.pathname.match(/^\/patient\/([^/]+)\/queue\/([^/]+)/);
      if (!m) return;
      const t = await api.getToken(m[2]).catch(() => null);
      if (!t || FINISHED.has(t.status)) router.replace(`/patient/${m[1]}/select-doctor`);
      else router.refresh();
    })();
  }, [router]);
  return null;
}

/**
 * "Add MedQR to your Home Screen" popup on the live token page. Opens by itself once (not again for
 * 3 days after closing) and whenever something fires OPEN_A2HS_EVENT (the iPhone alerts hint).
 * iPhone: Share → Add to Home Screen steps, with the hand-off code put in the address meanwhile.
 * Android: Chrome's own install prompt when it offers one, otherwise the ⋮ menu steps.
 */
export function AddToHomeScreen({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const p = isIos() ? 'ios' : isAndroid() ? 'android' : null;
    setPlatform(p);
    if (!p) return;
    const show = () => setOpen(true);
    window.addEventListener(OPEN_A2HS_EVENT, show);
    const t = active && !recentlyDismissed() ? setTimeout(show, 2000) : undefined;
    return () => {
      window.removeEventListener(OPEN_A2HS_EVENT, show);
      clearTimeout(t);
    };
  }, [active]);

  // iPhone: while the popup is open, the address carries the one-time code iOS will save.
  useEffect(() => {
    if (!open || platform !== 'ios') return;
    let cancelled = false;
    const path = window.location.pathname;
    setPreparing(true);
    createHandoff(path)
      .then((code) => {
        if (!cancelled) window.history.replaceState(window.history.state, '', `${path}?${HANDOFF_PARAM}=${code}`);
      })
      .catch(() => undefined) // offline: the icon still works, it just opens without the saved check-ins
      .finally(() => !cancelled && setPreparing(false));
    return () => {
      cancelled = true;
      window.history.replaceState(window.history.state, '', path);
    };
  }, [open, platform]);

  if (!open || !platform) return null;

  const close = () => {
    markDismissed();
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={close}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="a2hs-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-surface-container-lowest rounded-t-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shrink-0">
            <Icon name="add_to_home_screen" className="text-[26px]" />
          </span>
          <div className="flex-1">
            <h2 id="a2hs-title" className="font-headline-sm text-headline-sm text-on-surface">
              Add MedQR to your Home Screen
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Open your token in one tap{platform === 'ios' ? ' and get an alert when it’s your turn' : ''}.
            </p>
          </div>
          <button onClick={close} aria-label="Close" className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center text-on-surface-variant">
            <Icon name="close" className="text-[24px]" />
          </button>
        </div>

        {platform === 'ios' ? (
          <ol className="flex flex-col gap-3 bg-surface-container-low rounded-2xl p-4 font-body-md text-body-md text-on-surface">
            <li className="flex items-center gap-3">
              <Step n={1} />
              <span>
                Tap the <strong>Share</strong> button <Icon name="ios_share" className="text-[20px] align-middle text-primary" />
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Step n={2} />
              <span>
                Choose <strong>Add to Home Screen</strong> <Icon name="add_box" className="text-[20px] align-middle text-primary" />
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Step n={3} />
              <span>
                Open <strong>MedQR</strong> from your Home Screen and tap <strong>Alert me</strong>
              </span>
            </li>
          </ol>
        ) : canPromptInstall() ? (
          <button
            onClick={async () => {
              await promptInstall();
              close();
            }}
            className="h-12 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2"
          >
            <Icon name="add_to_home_screen" className="text-[20px]" /> Add to Home Screen
          </button>
        ) : (
          <ol className="flex flex-col gap-3 bg-surface-container-low rounded-2xl p-4 font-body-md text-body-md text-on-surface">
            <li className="flex items-center gap-3">
              <Step n={1} />
              <span>
                Tap the menu <Icon name="more_vert" className="text-[20px] align-middle text-primary" /> at the top right
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Step n={2} />
              <span>
                Choose <strong>Add to Home screen</strong> or <strong>Install app</strong>
              </span>
            </li>
          </ol>
        )}

        {platform === 'ios' && preparing && (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center">Getting your token ready for the Home Screen…</p>
        )}
        <button onClick={close} className="h-11 font-label-lg text-label-lg text-on-surface-variant">
          Not now
        </button>
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-md text-label-md shrink-0">
      {n}
    </span>
  );
}
