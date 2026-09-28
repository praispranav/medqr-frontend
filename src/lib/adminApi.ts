import { ApiError, type DoctorSession, type Entitlements, type QrCodeView, type Tenant, type TokenStatus } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
export const ADMIN_KEY_STORAGE = 'medqr:admin-key';

export function readAdminKey() {
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE);
  } catch {
    return null;
  }
}

async function request<T>(key: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/admin${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key, ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, typeof body?.message === 'string' ? body.message : `Request failed (${res.status})`);
  }
  return res.json();
}

export interface AdminTenant extends Tenant {
  created_at: string;
  doctor_count: number;
  tokens_today: number;
}

export interface AdminDoctor {
  id: string;
  tenant_id: string;
  name: string;
  qualification: string | null;
  specialty: string | null;
  cabin_label: string | null;
  photo_url: string | null;
}

export type AdminSession = DoctorSession;

export interface Activity {
  totals: { clinics: number; tokens_today: number; waiting: number; in_consultation: number; done: number; no_show: number };
  per_clinic: { id: string; name: string; subdomain: string; tokens_today: number; done: number; waiting: number }[];
  recent: {
    id: string;
    token_number: number;
    status: TokenStatus;
    joined_at: string;
    called_at: string | null;
    clinic: string;
    doctor: string;
    patient: string;
  }[];
}

export interface StaffLogin {
  id: string;
  tenant_id: string;
  role: 'reception' | 'doctor';
  name: string;
  username: string;
  doctor_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

type DoctorBody = Partial<Omit<AdminDoctor, 'id' | 'tenant_id'>>;

export const adminApi = (key: string) => ({
  ping: () => request<{ ok: true }>(key, '/ping'),
  activity: () => request<Activity>(key, '/activity'),
  tenants: () => request<AdminTenant[]>(key, '/tenants'),
  createTenant: (body: { subdomain: string; display_name: string }) =>
    request<Tenant>(key, '/tenants', { method: 'POST', body: JSON.stringify(body) }),
  tenant: (id: string) => request<Tenant>(key, `/tenants/${id}`),
  updateTenant: (id: string, body: { display_name?: string; entitlements?: Partial<Entitlements>; require_whatsapp_otp?: boolean }) =>
    request<Tenant>(key, `/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adjustWallet: (id: string, amount_inr: number) =>
    request<Tenant>(key, `/tenants/${id}/wallet`, { method: 'POST', body: JSON.stringify({ amount_inr }) }),
  doctors: (tenantId: string) => request<AdminDoctor[]>(key, `/tenants/${tenantId}/doctors`),
  createDoctor: (tenantId: string, body: DoctorBody) =>
    request<AdminDoctor>(key, `/tenants/${tenantId}/doctors`, { method: 'POST', body: JSON.stringify(body) }),
  updateDoctor: (id: string, body: DoctorBody) =>
    request<AdminDoctor>(key, `/doctors/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDoctor: (id: string) => request(key, `/doctors/${id}`, { method: 'DELETE' }),
  sessions: (doctorId: string, date: string) => request<AdminSession[]>(key, `/doctors/${doctorId}/sessions?date=${date}`),
  addSession: (doctorId: string, body: { session_date: string; starts_at: string; ends_at: string; is_break: boolean }) =>
    request<AdminSession>(key, `/doctors/${doctorId}/sessions`, { method: 'POST', body: JSON.stringify(body) }),
  repeatSchedule: (doctorId: string, from_date: string, days: number) =>
    request<{ copied_to: string[] }>(key, `/doctors/${doctorId}/sessions/repeat`, {
      method: 'POST',
      body: JSON.stringify({ from_date, days }),
    }),
  setSessionActive: (id: string, is_active: boolean) =>
    request<AdminSession>(key, `/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
  deleteSession: (id: string) => request(key, `/sessions/${id}`, { method: 'DELETE' }),
  users: (tenantId: string) => request<StaffLogin[]>(key, `/tenants/${tenantId}/users`),
  createUser: (
    tenantId: string,
    body: { role: 'reception' | 'doctor'; name: string; username: string; password: string; doctor_id?: string | null },
  ) => request<StaffLogin>(key, `/tenants/${tenantId}/users`, { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name?: string; is_active?: boolean; password?: string }) =>
    request<StaffLogin>(key, `/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string) => request(key, `/users/${id}`, { method: 'DELETE' }),
  qrCodes: (status?: string) => request<QrCodeView[]>(key, `/qr-codes${status ? `?status=${status}` : ''}`),
  createQrCodes: (count: number, label: string) =>
    request<QrCodeView[]>(key, '/qr-codes', { method: 'POST', body: JSON.stringify({ count, label }) }),
  updateQrCode: (id: string, body: { doctor_id?: string | null; status?: 'disabled' | 'active' }) =>
    request<QrCodeView>(key, `/qr-codes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
});

export type AdminApi = ReturnType<typeof adminApi>;
