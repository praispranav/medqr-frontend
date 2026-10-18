'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

/**
 * Decision 66 — on a doctor or clinic without online OPD booking, a patient can ask for it. We count the
 * request (once per device per clinic per day) and the ClinicQ team follows up with the clinic. The patient
 * can also message the clinic directly on WhatsApp with a ready-made note; nothing is sent for them.
 */
export function AskOnlineBooking({ doctorSlug, clinicSlug, clinicCode, compact = false }: { doctorSlug?: string; clinicSlug?: string; clinicCode?: string; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [phone, setPhone] = useState<string | null>(null);
  const [name, setName] = useState('');

  const ask = async () => {
    setState('busy');
    try {
      const r = await api.requestOnlineBooking({ doctor_slug: doctorSlug, clinic_slug: clinicSlug, clinic_code: clinicCode });
      setPhone(r.clinic_phone);
      setName(r.clinic_name);
      setState('done');
    } catch {
      setState('error');
    }
  };

  const digits = (phone ?? '').replace(/\D/g, '').slice(-10);
  const wa = /^[6-9]\d{9}$/.test(digits)
    ? `https://wa.me/91${digits}?text=${encodeURIComponent(`Hello ${name}, I found your clinic on ClinicQ (clinicq.fit). Please start online OPD booking so patients can take a token from their phone.`)}`
    : null;

  if (state === 'done') {
    return (
      <div className={`flex flex-col gap-2 ${compact ? '' : 'items-center text-center'}`}>
        <p className="font-body-sm text-body-sm text-on-surface flex items-center gap-1.5">
          <Icon name="check_circle" className="text-[18px] text-tertiary" /> Thanks! We&apos;ll ask the clinic to start online booking.
        </p>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="h-10 px-4 self-start rounded-xl bg-[#25D366] text-white font-label-md text-label-md inline-flex items-center gap-2">
            <Icon name="chat" className="text-[18px]" /> Message the clinic on WhatsApp
          </a>
        )}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={ask}
      disabled={state === 'busy'}
      className={`${compact ? 'h-9 px-3 text-label-md font-label-md' : 'h-12 px-5 text-label-lg font-label-lg'} self-start rounded-xl border border-primary/30 text-primary inline-flex items-center gap-2 disabled:opacity-60`}
    >
      <Icon name="notifications_active" className="text-[18px]" />
      {state === 'busy' ? 'Sending…' : state === 'error' ? 'Try again' : 'Ask for online booking'}
    </button>
  );
}
