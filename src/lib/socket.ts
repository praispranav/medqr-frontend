import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Single shared connection to the /queue namespace — powers live token updates (Decision 1 & 7). */
export function getQueueSocket(): Socket {
  if (!socket) {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
    // Default transports (long-polling first, then upgrade to WebSocket): networks or proxies that
    // block WebSockets still get live updates. Reconnect forever — phones drop connections a lot.
    socket = io(`${base}/queue`, { reconnection: true, reconnectionAttempts: Infinity, reconnectionDelayMax: 10_000 });
  }
  return socket;
}

/**
 * iOS Safari suspends background tabs and restores pages from its back-forward cache without
 * telling the socket, so a token page can sit "live" but deaf. Call this from live pages: whenever
 * the page comes back (tab visible, bfcache restore, network back, window focus) it reconnects the
 * socket if needed and runs `onResume` (refetch). It ALSO refetches every `pollMs` while the page
 * is on screen, socket or not — Safari can leave a socket that believes it's connected but receives
 * nothing, so a plain timed refresh is the one thing that always works. Paused when hidden.
 * Returns a cleanup function.
 */
export function keepLive(onResume: () => void, pollMs = 15_000): () => void {
  const s = getQueueSocket();
  const resume = () => {
    if (document.visibilityState !== 'visible') return;
    if (!s.connected) s.connect();
    onResume();
  };
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) resume(); // restored from the back-forward cache
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('online', resume);
  window.addEventListener('focus', resume);
  const timer = setInterval(() => {
    if (document.visibilityState !== 'visible') return; // screen off / tab hidden → no polling
    if (!s.connected) s.connect();
    onResume();
  }, pollMs);
  return () => {
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('online', resume);
    window.removeEventListener('focus', resume);
    clearInterval(timer);
  };
}
