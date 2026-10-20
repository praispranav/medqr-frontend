export const CITY_STORAGE_KEY = 'clinicq:selected_city';
export const GEO_PROMPT_DISMISSED_KEY = 'clinicq:geo_prompt_dismissed';

export const KNOWN_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  sitamarhi: { lat: 26.5937, lng: 85.4925 },
  muzaffarpur: { lat: 26.1209, lng: 85.3647 },
  patna: { lat: 25.5941, lng: 85.1376 },
  'harpur bakhri': { lat: 25.962, lng: 85.385 },
  'rasulpur saidpur bazid': { lat: 25.962, lng: 85.385 },
  darbhanga: { lat: 26.1542, lng: 85.8918 },
  gaya: { lat: 24.7914, lng: 85.0002 },
  motihari: { lat: 26.6469, lng: 84.9089 },
  samastipur: { lat: 25.863, lng: 85.781 },
  bhagalpur: { lat: 25.2425, lng: 86.9842 },
  begusarai: { lat: 25.4182, lng: 86.1272 },
  purnia: { lat: 25.7771, lng: 87.4753 },
  katihar: { lat: 25.5541, lng: 87.5684 },
  arrah: { lat: 25.556, lng: 84.6603 },
  chhapra: { lat: 25.7796, lng: 84.7499 },
  hajipur: { lat: 25.6858, lng: 85.2146 },
  siwan: { lat: 26.2196, lng: 84.3567 },
  buxar: { lat: 25.5647, lng: 83.9777 },
  bettiah: { lat: 26.8024, lng: 84.5029 },
  deoghar: { lat: 24.4826, lng: 86.7 },
  ranchi: { lat: 23.3441, lng: 85.3096 },
};

/** Calculate great-circle distance between two points in km */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Given a user's coordinates and available directory cities, find the closest matching city */
export function findClosestCity(userLat: number, userLng: number, availableCities: string[]): string | null {
  if (!availableCities || availableCities.length === 0) return null;

  let bestCity: string | null = null;
  let minDistance = Infinity;

  for (const city of availableCities) {
    const key = city.trim().toLowerCase();
    const coords = KNOWN_CITY_COORDS[key];
    if (coords) {
      const dist = haversineDistance(userLat, userLng, coords.lat, coords.lng);
      if (dist < minDistance) {
        minDistance = dist;
        bestCity = city;
      }
    }
  }

  return minDistance <= 75 ? bestCity : null;
}

/** Reverse geocoding via OpenStreetMap Nominatim with a fast 2s timeout */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address;
    return addr?.city || addr?.town || addr?.county || addr?.state_district || null;
  } catch {
    return null;
  }
}

/** Get persisted city from localStorage */
export function getStoredCity(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CITY_STORAGE_KEY) || localStorage.getItem('clinicq_user_city') || null;
  } catch {
    return null;
  }
}

/** Persist city to localStorage */
export function setStoredCity(city: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (city && city.trim()) {
      localStorage.setItem(CITY_STORAGE_KEY, city.trim());
      localStorage.setItem('clinicq_user_city', city.trim());
    } else {
      localStorage.removeItem(CITY_STORAGE_KEY);
      localStorage.removeItem('clinicq_user_city');
    }
  } catch {}
}

/** A bounded fresh fix, then a coarse retry. Permission alone does not guarantee a GPS fix. */
export async function detectCoordinates(geo: Pick<Geolocation, 'getCurrentPosition'>): Promise<GeolocationCoordinates> {
  const attempt = (highAccuracy: boolean, timeout: number) => new Promise<GeolocationCoordinates>((resolve, reject) => {
    let settled = false;
    const finish = (coords?: GeolocationCoordinates, error?: unknown) => {
      if (settled) return;
      settled = true; clearTimeout(watchdog);
      if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) resolve(coords);
      else reject(error ?? {code:2});
    };
    const watchdog = setTimeout(() => finish(undefined, {code:3}), timeout + 1000);
    try { geo.getCurrentPosition(p => finish(p.coords), e => finish(undefined, e), {enableHighAccuracy:highAccuracy,timeout,maximumAge:highAccuracy?0:300_000}); }
    catch (error) { finish(undefined, error); }
  });
  try { return await attempt(true, 15_000); }
  catch (error) { if ((error as {code?:number})?.code === 1) throw error; return attempt(false, 10_000); }
}
