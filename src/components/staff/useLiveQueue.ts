'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type QueueRow } from '@/lib/api';
import { getQueueSocket } from '@/lib/socket';

/**
 * Today's queue for a clinic (or one doctor), kept live over the shared queue socket.
 * Any session change (Decision 1), join, check-in or no-show in these doctors' rooms triggers a refetch.
 */
export function useLiveQueue(tenantId: string, doctorIds: string[], onlyDoctorId?: string) {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [connected, setConnected] = useState(false);
  const roomKey = doctorIds.join(',');

  const refresh = useCallback(async () => {
    try {
      setRows(await api.listQueueToday(tenantId, onlyDoctorId));
    } catch {
      /* keep last good rows; the next event or focus retries */
    }
  }, [tenantId, onlyDoctorId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const socket = getQueueSocket();
    const ids = roomKey ? roomKey.split(',') : [];
    const join = () => {
      setConnected(true);
      ids.forEach((id) => socket.emit('join_doctor_room', id));
      refresh();
    };
    const onDisconnect = () => setConnected(false);
    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on('session:changed', refresh);
    socket.on('queue:changed', refresh);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('session:changed', refresh);
      socket.off('queue:changed', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [roomKey, refresh]);

    const [calledTokenId, setCalledTokenId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getQueueSocket();
    const handleSessionChanged = (payload: any) => {
      if (payload?.activeTokenId) {
        setCalledTokenId(payload.activeTokenId);
        setTimeout(() => setCalledTokenId(null), 10000);
      }
    };
    socket.on('session:changed', handleSessionChanged);
    return () => {
      socket.off('session:changed', handleSessionChanged);
    };
  }, []);

  return { rows, refresh, connected, calledTokenId, setCalledTokenId };
}
