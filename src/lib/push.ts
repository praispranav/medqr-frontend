// "Alert me when it's my turn" — Firebase Cloud Messaging web push for a patient's token.
// Config is the Firebase web app config (public by design). The VAPID key comes from Firebase
// console → Project settings → Cloud Messaging → Web Push certificates (public key, safe in code). iPhone: web push only works once the page is added to the Home Screen
// (iOS 16.4+), so we show that hint instead of a button that can't work.
import { isIos, isStandalone } from '@/lib/homeScreen';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyDsOnQA1kATykSpgxKnIx3Sr5LT2oSV-fQ',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'medqr-a2a21.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'medqr-a2a21',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'medqr-a2a21.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '736406084814',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '1:736406084814:web:738db228503de9207bc49f',
};
const VAPID_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ??
  'BMnnUIW4fBCpBryRL6pm4u5Wj4F34dhckt50FcpS4pHgUrl1jjTnpGaZu6FtGYP4gmSHO_90Ww1lbsdRQq97SNI';

export type PushSupport = 'ok' | 'not_configured' | 'ios_needs_home_screen' | 'unsupported' | 'denied';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (!VAPID_KEY) return 'not_configured';
  if (isIos() && !isStandalone()) return 'ios_needs_home_screen';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

/** Ask permission, get this phone's FCM token. Throws a readable Error when it can't. */
export async function getPushToken(): Promise<string> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked — allow them for this site in your browser settings.');
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Could not turn on alerts on this phone.');
  return token;
}
