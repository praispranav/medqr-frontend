'use client';

import { SearchClientView } from '@/app/search/SearchClientView';

/** Clinics, doctors and combined discovery share one compact search UI. */
export function ClinicsSearch({ initialQ = '', initialCity = '', initialArea = '', initialBookable = false, initialToday = false }: {
  initialQ?: string; initialCity?: string; initialArea?: string; initialBookable?: boolean; initialToday?: boolean;
}) {
  return <SearchClientView initialType="clinics" initialQ={initialQ} initialCity={initialCity} initialArea={initialArea} initialBookable={initialBookable} initialToday={initialToday} />;
}
