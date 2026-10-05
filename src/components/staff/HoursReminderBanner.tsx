'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type HoursStatus } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// The gentle in-app reminder (Decision 21): today — or tomorrow — has no consulting hours and the
// doctor isn't deliberately off that day. One tap answers it either way: add hours, or say "I'm off"
// (which is remembered, so the 8:30 AM / 7 PM WhatsApp reminders skip that day too).
export function HoursReminderBanner({
  doctorId,
  linkToHours = true,
  refreshKey,
  onChanged,
}: {
  doctorId: string;
  linkToHours?: boolean;
  refreshKey?: unknown;
  onChanged?: () => void;
}) {
  const [status, setStatus] = useState<HoursStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.hoursStatus(doctorId).then(setStatus).catch(() => setStatus(null));
  }, [doctorId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!status) return null;
  const day = !status.today.has_hours && !status.today.off ? status.today : !status.tomorrow.has_hours && !status.tomorrow.off ? status.tomorrow : null;
  if (!day) return null;
  const isToday = day === status.today;
  const label = new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  const imOff = async () => {
    setBusy(true);
    try {
      await api.setHoursDay(doctorId, day.date, []); // marks the day deliberately off
      load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-secondary-fixed/50 text-on-secondary-fixed rounded-2xl p-4 flex items-center gap-3 flex-wrap">
      <Icon name="event_note" className="text-[24px]" />
      <p className="flex-1 min-w-[220px] font-body-md text-body-md">
        <strong>{isToday ? 'No hours set for today.' : `No hours set for tomorrow (${label}).`}</strong>{' '}
        {isToday ? 'Patients can’t join your queue today until you add them.' : 'Patients can’t book you for tomorrow yet.'}
      </p>
      <div className="flex gap-2">
        {linkToHours && (
          <Link href="/doctor/hours" className="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center">
            {isToday ? 'Add today’s hours' : 'Add hours'}
          </Link>
        )}
        <button disabled={busy} onClick={imOff} className="h-10 px-4 rounded-xl bg-surface-container-lowest text-on-surface font-label-md text-label-md disabled:opacity-50">
          {isToday ? 'I’m off today' : 'I’m off tomorrow'}
        </button>
      </div>
    </div>
  );
}
