'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PATIENT_DEVICE_EVENT } from '@/lib/patientDevice';
import { patientUrl } from '@/lib/clinicHost';
import { homeFor } from '@/lib/staffRoutes';

/** Match the session used by location preferences, including remembered staff cookies. */
export function PublicAccountLink() {
  const [account, setAccount] = useState<{href:string;label:string} | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    let generation = 0;
    const check = async () => {
      const current = ++generation;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const session = await api.locationPreference(controller.signal);
        let next: {href:string;label:string} | null = null;
        if (session.authenticated) {
          if (session.account_type === 'staff') {
            next = {href:'/login',label:'Clinic account'};
            try { const me = await api.me(controller.signal); next = {href:homeFor(me),label:'Clinic dashboard'}; } catch { /* Session was confirmed; keep the account label if dashboard details are unavailable. */ }
          } else if (session.account_type === 'admin') next = {href:'/owner',label:'Owner account'};
          else if (session.account_type === 'patient') next = {href:patientUrl('/patient',window.location.hostname),label:'My tokens'};
          else next = {href:'/signin',label:'Account'};
        }
        if (live && current === generation) setAccount(next);
      } catch { if (live && current === generation) setAccount(null); }
      finally { clearTimeout(timeout); if (live && current === generation) setReady(true); }
    };
    void check();
    window.addEventListener(PATIENT_DEVICE_EVENT, check);
    window.addEventListener('focus', check);
    return () => { live = false; window.removeEventListener(PATIENT_DEVICE_EVENT, check); window.removeEventListener('focus', check); };
  }, []);
  if (!ready) return <span className="h-10 min-w-24" aria-label="Checking sign-in status"/>;
  return <Link href={account?.href ?? '/signin'} title={account ? 'You are signed in' : 'Sign in to ClinicQ'} className="h-10 px-5 inline-flex items-center whitespace-nowrap rounded-xl bg-primary text-on-primary font-label-md text-label-md">{account?.label ?? 'Sign in'}</Link>;
}
