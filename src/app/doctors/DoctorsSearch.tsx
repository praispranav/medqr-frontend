'use client';

import { SearchClientView } from '@/app/search/SearchClientView';
import type { DirectoryDoctorSummary } from '@/lib/api';

export const DOCTORS_PAGE_SIZE = 24;

/** The same search interface as /search and /clinics; doctor SEO pages retain their first page. */
export function DoctorsSearch({ initialQ = '', initialGroup = '', initialCity = '', initialBookable = false, initialResults, initialArea = '', initialToday = false, syncUrl = true }: {
  initialQ?: string; initialGroup?: string; initialCity?: string; initialBookable?: boolean;
  initialArea?: string; initialToday?: boolean; initialResults?: DirectoryDoctorSummary[]; syncUrl?: boolean;
}) {
  return <SearchClientView initialType="doctors" initialQ={initialQ} initialGroup={initialGroup} initialCity={initialCity} initialArea={initialArea} initialToday={initialToday} initialBookable={initialBookable} initialDoctors={initialResults} syncUrl={syncUrl} />;
}
