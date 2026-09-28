import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Single shared connection to the /queue namespace — powers live token updates (Decision 1 & 7). */
export function getQueueSocket(): Socket {
  if (!socket) {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
    socket = io(`${base}/queue`, { transports: ['websocket'] });
  }
  return socket;
}
