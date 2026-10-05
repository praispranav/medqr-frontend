import { api } from '@/lib/api';

// "Add to Home Screen" for patients. On iPhone the Home Screen app starts with EMPTY storage (it
// doesn't share Safari's localStorage), so the patient's saved check-ins would vanish. While the
// add sheet is open we park these keys on the server under a one-time code and put ONLY that code
// in the page address — iOS saves the address as the icon's link. First launch redeems it.
// Android/Chrome shares storage with the browser, so it needs none of this.

const KEYS = ['medqr_patient_tokens', 'medqr:patient-token', 'medqr:mobile'] as const;
const DISMISSED_KEY = 'medqr:a2hs-dismissed';
export const HANDOFF_PARAM = 'h';
export const OPEN_A2HS_EVENT = 'medqr:add-to-home-screen';

export function isIos() {
  if (typeof navigator === 'undefined' || /Android/i.test(navigator.userAgent)) return false;
  // iPadOS reports itself as a Mac — a touch screen gives it away.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
export function isAndroid() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Chrome's install prompt, caught early (it fires once, often before the page's components mount). */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installPrompt: InstallPrompt | null = null;
export function catchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as InstallPrompt;
  });
}
export function canPromptInstall() {
  return !!installPrompt;
}
export async function promptInstall() {
  if (!installPrompt) return false;
  await installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  return outcome === 'accepted';
}

/** Show the auto popup at most once every 3 days per phone. */
export function recentlyDismissed() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) || 0) < 3 * 24 * 3600_000;
  } catch {
    return false;
  }
}
export function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** iPhone: park the keys (+ the page to open first) and return the code. */
export async function createHandoff(openPath: string) {
  const data: Record<string, string> = { open: openPath };
  try {
    for (const k of KEYS) {
      const v = localStorage.getItem(k);
      if (v) data[k] = v;
    }
  } catch {
    /* private mode — nothing saved to carry */
  }
  return (await api.createHandoff(data)).code;
}

/** Home Screen app, first launch: copy the keys in (keeping anything already there) and say where to go. */
export async function redeemHandoff(code: string): Promise<string | null> {
  const { data } = await api.redeemHandoff(code);
  try {
    const hadDevice = !!localStorage.getItem('medqr:patient-token');
    for (const k of KEYS) {
      const v = data[k];
      if (!v) continue;
      if (k === 'medqr_patient_tokens') {
        const mine = JSON.parse(localStorage.getItem(k) || '[]') as { id: string }[];
        const theirs = JSON.parse(v) as { id: string }[];
        const merged = [...mine, ...theirs.filter((t) => !mine.some((m) => m.id === t.id))];
        localStorage.setItem(k, JSON.stringify(merged));
      } else if (!hadDevice) {
        localStorage.setItem(k, v); // token + mobile travel as a pair — never mix two phones' halves
      }
    }
  } catch {
    /* ignore */
  }
  return data.open?.startsWith('/patient/') ? data.open : null;
}
