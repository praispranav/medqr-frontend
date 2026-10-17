'use client';

import { useEffect, useState } from 'react';

/**
 * The browser's host, read after hydration (null during the server render and the first browser
 * render, so both agree). Pass it to patientUrl() / mainUrl() in client components: links start on
 * the primary domain and switch to the visitor's own root domain (clinicq.in vs clinicq.fit) once mounted.
 */
export function useHost(): string | null {
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => setHost(window.location.host), []);
  return host;
}
