'use client';

import { useEffect, useState } from 'react';
import { patientDevice, patientLogoutPath, PATIENT_DEVICE_EVENT, PATIENT_LOGOUT_KEY } from '@/lib/patientDevice';
import { useT } from '@/lib/i18n';

/** Shared patient logout; changing numbers remains a separate, non-destructive action. */
export function PatientLogout() {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const refresh = () => setVisible(!!patientDevice.get() || patientDevice.savedNumbers().length > 0);
    const leave = () => window.location.replace(patientLogoutPath(window.location.hostname));
    const storage = (event: StorageEvent) => {
      if (event.key === PATIENT_LOGOUT_KEY && event.newValue) leave();
      else refresh();
    };
    const logoutAtMount = patientDevice.logoutStamp();
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted && patientDevice.logoutStamp() !== logoutAtMount) leave();
      else refresh();
    };
    refresh();
    window.addEventListener(PATIENT_DEVICE_EVENT, refresh);
    window.addEventListener('storage', storage);
    window.addEventListener('pageshow', pageshow);
    return () => {
      window.removeEventListener(PATIENT_DEVICE_EVENT, refresh);
      window.removeEventListener('storage', storage);
      window.removeEventListener('pageshow', pageshow);
    };
  }, []);
  if (!visible) return null;
  return (
    <button type="button" onClick={() => {
      patientDevice.logout();
      window.location.replace(patientLogoutPath(window.location.hostname));
    }} className="min-h-[44px] shrink-0 px-2 rounded-xl flex items-center gap-1.5 text-primary font-label-sm text-label-sm hover:bg-surface-container active:bg-surface-container touch-manipulation">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
      {t('patient_logout')}
    </button>
  );
}
