// Decision 67 — free "near me": the browser's own location, matched to the nearest directory city from a
// small built-in table (no maps API, nothing sent to a third party). Add a city here when listings arrive.
const CITY_COORDS: Record<string, [number, number]> = {
  Patna: [25.5941, 85.1376],
  Sitamarhi: [26.5952, 85.4808],
  Muzaffarpur: [26.1209, 85.3647],
  Darbhanga: [26.1542, 85.8918],
  Gaya: [24.7955, 85.0002],
  Bhagalpur: [25.2425, 86.9842],
  Ranchi: [23.3441, 85.3096],
  Delhi: [28.6139, 77.209],
};

const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** The directory city nearest to the visitor (within 80 km), or null. Asks the browser for location once. */
export function nearestDirectoryCity(cities: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here: [number, number] = [coords.latitude, coords.longitude];
        const best = cities
          .filter((c) => CITY_COORDS[c])
          .map((c) => ({ c, d: km(here, CITY_COORDS[c]) }))
          .sort((a, b) => a.d - b.d)[0];
        resolve(best && best.d <= 80 ? best.c : null);
      },
      () => resolve(null),
      { maximumAge: 24 * 3600_000, timeout: 8000 },
    );
  });
}
