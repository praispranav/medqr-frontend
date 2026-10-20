export type DirectorySearchFilters = { q: string; type: 'all'|'doctors'|'clinics'; city: string; area: string; group: string; today: boolean; bookable: boolean };
/** Canonical shared search: explicit category and even an empty city override personal location defaults. */
export function directorySearchPath(filters: DirectorySearchFilters): string {
  const p=new URLSearchParams({type:filters.type,city:filters.city});
  if(filters.q.trim())p.set('q',filters.q.trim());
  if(filters.area.trim())p.set('area',filters.area.trim());
  if(filters.group)p.set('specialty',filters.group);
  if(filters.today)p.set('today','1');
  if(filters.bookable)p.set('online','1');
  return `/search?${p}`;
}
export function readDirectorySearch(p: URLSearchParams, fallback: DirectorySearchFilters): DirectorySearchFilters {
  const type=p.get('type');
  return {
    q:p.has('q')?(p.get('q')??'').trim():fallback.q,
    type:type==='all'||type==='doctors'||type==='clinics'?type:fallback.type,
    city:p.has('city')?(p.get('city')??'').trim():fallback.city,
    area:p.has('area')?(p.get('area')??'').trim():fallback.area,
    group:p.has('specialty')?(p.get('specialty')??'').trim():fallback.group,
    today:p.has('today')?p.get('today')==='1':fallback.today,
    bookable:p.has('online')?p.get('online')==='1':p.has('bookable')?p.get('bookable')==='1':fallback.bookable,
  };
}
