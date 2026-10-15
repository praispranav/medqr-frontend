// Signed patient sessions already kept on this browser. Switching numbers pauses
// the active session; it must not erase the family's saved access (Decision 12).
const TOKEN_KEY = 'medqr:patient-token';
const MOBILE_KEY = 'medqr:mobile';
const SAVED_KEY = 'medqr:saved-patient-devices';
type Device = { token: string; mobile: string };
const digits = (mobile: string) => mobile.replace(/\D/g, '').slice(-10);

function active(): Device | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const mobile = localStorage.getItem(MOBILE_KEY);
    return token && mobile ? { token, mobile: digits(mobile) } : null;
  } catch {
    return null;
  }
}

function saved(): Device[] {
  let devices: Device[] = [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    if (Array.isArray(value)) {
      devices = value.filter((v): v is Device => !!v && typeof v.token === 'string' && !!v.token && typeof v.mobile === 'string' && /^\d{10}$/.test(v.mobile));
    }
  } catch { /* Private storage or an old invalid value: the current session still works. */ }
  const current = active();
  return current ? [current, ...devices.filter((d) => d.mobile !== current.mobile)].slice(0, 10) : devices.slice(0, 10);
}

function store(devices: Device[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(devices.slice(0, 10))); } catch { /* Storage may be unavailable. */ }
}

export const patientDevice = {
  get: active,
  set(token: string, mobile: string) {
    const normalized = digits(mobile);
    store([{ token, mobile: normalized }, ...saved().filter((d) => d.mobile !== normalized)]);
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(MOBILE_KEY, normalized);
    } catch { /* Private storage: the browser may not remember this visit. */ }
  },
  savedNumbers(): string[] {
    return saved().map((d) => d.mobile);
  },
  useSaved(mobile: string): boolean {
    const device = saved().find((d) => d.mobile === digits(mobile));
    if (!device) return false;
    patientDevice.set(device.token, device.mobile);
    return active()?.token === device.token;
  },
  switchNumber() {
    store(saved());
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(MOBILE_KEY);
    } catch { /* ignore */ }
  },
  // Expired credentials and "don't remember" really forget this number. Other
  // remembered numbers remain separate; no profile is fetched by mobile alone.
  clear() {
    const current = active();
    store(saved().filter((d) => d.mobile !== current?.mobile));
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(MOBILE_KEY);
    } catch { /* ignore */ }
  },
};
