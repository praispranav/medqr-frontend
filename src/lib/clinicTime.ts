// Clinic time on the client: "today" is the date in India (Asia/Kolkata), matching the backend's
// common/clinic-time.ts — never the UTC date, which is still yesterday until 05:30 IST.

export const CLINIC_TZ = 'Asia/Kolkata';

/** 'YYYY-MM-DD' in clinic time. */
export function clinicToday(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Calendar arithmetic on 'YYYY-MM-DD' strings. */
export function addDays(date: string, n: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
