import { ApiError, type ArrivalQr, type DoctorSession, type Entitlements, type HoursSlot, type HoursWeek, type QrCodeView, type QueueSettings, type QueueSetupMessage, type QueueSetupTurn, type StaffLinkResult, type Tenant, type TokenStatus } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
/** Old key-in-the-browser storage — cleared on sign-in; the admin panel now uses an email + password login. */
export const ADMIN_KEY_STORAGE = 'medqr:admin-key';

/**
 * Platform admin requests ride on the httpOnly `medqr_admin_session` cookie (credentials:
 * 'include'). `key` is only for scripts that still use ADMIN_API_KEY; the web panel passes ''.
 */
async function request<T>(key: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/owner${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'x-admin-key': key } : {}), ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, typeof body?.message === 'string' ? body.message : `Request failed (${res.status})`);
  }
  return res.json();
}

export type SubscriptionStatus = 'trial' | 'active' | 'grace' | 'read_only';

export interface SubscriptionStatusView {
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  autopay_active: boolean;
  wallet_auto_recharge_enabled: boolean;
  wallet_auto_recharge_below_inr: number;
  wallet_auto_recharge_amount_inr: number;
  /** Decision 36: coupon snapshot on this clinic. */
  coupon_code?: string | null;
  coupon_percent_off?: number;
  coupon_free_months?: number;
  discount_until?: string | null;
  coupon_applied_by?: string | null;
  plan_amount_inr?: number | null;
  /** Autopay needs attention (e.g. Razorpay refused a plan change). */
  billing_note?: string | null;
}

/** Decision 36 — a discount code. */
export interface Coupon {
  id: string;
  code: string;
  percent_off: number;
  discount_months: number;
  free_months: number;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  referrer_id: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
  clinics?: { id: string; name: string; discount_until: string | null }[];
}
export type CouponInput = Partial<Pick<Coupon, 'code' | 'percent_off' | 'discount_months' | 'free_months' | 'max_uses' | 'valid_until' | 'referrer_id' | 'note' | 'is_active'>>;

export type TrialLeadStatus = 'new' | 'contacted' | 'converted' | 'dismissed';

export interface TrialLead {
  id: string;
  clinic_name: string;
  contact_name: string;
  phone: string;
  email: string | null;
  city: string | null;
  message: string | null;
  status: TrialLeadStatus;
  created_at: string;
}

export interface ModuleRequest {
  id: string;
  tenant_id: string;
  module_key: string;
  requested_by: string | null;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
}

/** An ask from the Queue Setup AI chat for something not yet configurable (doctor, or a referrer relaying them). */
export interface SettingRequest {
  id: string;
  tenant_id: string;
  description: string;
  requested_by: string | null;
  status: 'pending' | 'done' | 'dismissed';
  created_at: string;
}

export interface AdminTenant extends Tenant {
  created_at: string;
  doctor_count: number;
  tokens_today: number;
  subscription?: { status: SubscriptionStatus; trial_ends_at: string | null; grace_ends_at: string | null };
  /** Decision 27: the referral partner who looks after this clinic, if any. */
  referrer_id?: string | null;
}

export interface AdminDoctor {
  id: string;
  tenant_id: string;
  name: string;
  qualification: string | null;
  specialty: string | null;
  cabin_label: string | null;
  photo_url: string | null;
  bio: string | null;
  is_publicly_listed: boolean;
  public_slug: string | null;
  /** Decision 28: this doctor's own settings (overrides the clinic's Queue Rules). */
  settings_override?: Partial<QueueSettings> | null;
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
  role: 'reception' | 'doctor' | 'owner';
  name: string;
  username: string;
  doctor_id: string | null;
  mobile_number: string | null; // Decision 15: where a password reset is sent, via WhatsApp
  must_change_password: boolean;
  is_owner: boolean; // Decision 14: clinic admin (owner login, or a doctor with owner access)
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

type DoctorBody = Partial<Omit<AdminDoctor, 'id' | 'tenant_id' | 'public_slug'>>;

export const adminApi = (key: string) => ({
  ping: () => request<{ ok: true }>(key, '/ping'),
  activity: () => request<Activity>(key, '/activity'),
  tenants: () => request<AdminTenant[]>(key, '/tenants'),
  createTenant: (body: { subdomain: string; display_name: string; trial_days?: number; city?: string; address?: string; coupon_code?: string }) =>
    request<Tenant>(key, '/tenants', { method: 'POST', body: JSON.stringify(body) }),
  tenant: (id: string) => request<Tenant>(key, `/tenants/${id}`),
  deleteTenant: (id: string) => request(key, `/tenants/${id}`, { method: 'DELETE' }),
  subscription: (id: string) => request<SubscriptionStatusView>(key, `/tenants/${id}/subscription`),
  // Decision 36 — coupons
  coupons: () => request<Coupon[]>(key, '/coupons'),
  createCoupon: (body: CouponInput) => request<Coupon>(key, '/coupons', { method: 'POST', body: JSON.stringify(body) }),
  updateCoupon: (id: string, body: CouponInput) => request<Coupon>(key, `/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  myCoupons: () => request<Coupon[]>(key, '/me/coupons'),
  applyCoupon: (tenantId: string, code: string) => request<unknown>(key, `/tenants/${tenantId}/coupon`, { method: 'POST', body: JSON.stringify({ code }) }),
  removeCoupon: (tenantId: string) => request<unknown>(key, `/tenants/${tenantId}/coupon`, { method: 'DELETE' }),
  extendTrial: (id: string, days: number) =>
    request<SubscriptionStatusView>(key, `/tenants/${id}/subscription/extend-trial`, { method: 'POST', body: JSON.stringify({ days }) }),
  extendSubscription: (id: string, days: number) =>
    request<SubscriptionStatusView>(key, `/tenants/${id}/subscription/extend`, { method: 'POST', body: JSON.stringify({ days }) }),
  grantGrace: (id: string, days: number) =>
    request<SubscriptionStatusView>(key, `/tenants/${id}/subscription/grace`, { method: 'POST', body: JSON.stringify({ days }) }),
  setSubscriptionActive: (id: string) =>
    request<SubscriptionStatusView>(key, `/tenants/${id}/subscription/set-active`, { method: 'POST' }),
  updateTenant: (
    id: string,
    body: {
      display_name?: string;
      entitlements?: Partial<Entitlements>;
      require_whatsapp_otp?: boolean;
      is_publicly_listed?: boolean;
      city?: string | null;
      address?: string | null;
      public_phone?: string | null;
      queue_settings?: Partial<QueueSettings>;
    },
  ) => request<Tenant>(key, `/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  /** Help a doctor set up: profile fields, Patient Notifications toggles, Intake Form. */
  updateDoctorProfile: (
    id: string,
    body: {
      intake_schema?: unknown;
      /** Decision 35: this doctor's patient-screen language ('' / null = clinic default). */
      patient_language?: string | null;
      notify_token_confirmed?: boolean;
      notify_you_are_next?: boolean;
      notify_your_turn?: boolean;
      notify_location_override?: string;
    },
  ) => request<AdminDoctor>(key, `/doctors/${id}/profile`, { method: 'PATCH', body: JSON.stringify(body) }),
  adjustWallet: (id: string, amount_inr: number) =>
    request<Tenant>(key, `/tenants/${id}/wallet`, { method: 'POST', body: JSON.stringify({ amount_inr }) }),
  doctors: (tenantId: string) => request<AdminDoctor[]>(key, `/tenants/${tenantId}/doctors`),
  createDoctor: (tenantId: string, body: DoctorBody) =>
    request<AdminDoctor>(key, `/tenants/${tenantId}/doctors`, { method: 'POST', body: JSON.stringify(body) }),
  /** Decision 28: a doctor's own fee / payment / pacing (null for a key = clinic default). */
  updateDoctorSettings: (id: string, patch: Record<string, unknown>) =>
    request<AdminDoctor>(key, `/doctors/${id}/settings`, { method: 'PATCH', body: JSON.stringify(patch) }),
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
  getWeeklyTemplate: (doctorId: string) =>
    request<{ template: Record<string, { starts_at: string; ends_at: string; is_break: boolean }[]>; weeks: number; applied_until: string | null }>(
      key,
      `/doctors/${doctorId}/sessions/weekly-template`,
    ),
  hoursWeek: (doctorId: string, from: string) => request<HoursWeek>(key, `/doctors/${doctorId}/sessions/week?from=${from}`),
  setHoursDay: (doctorId: string, date: string, slots: HoursSlot[]) =>
    request(key, `/doctors/${doctorId}/sessions/day`, { method: 'POST', body: JSON.stringify({ date, slots }) }),
  /** Guided Queue Rules setup (Decision 27 referrer onboarding) — only ever proposes a patch, never saves it. */
  queueSetupChat: (tenantId: string, messages: QueueSetupMessage[]) =>
    request<QueueSetupTurn>(key, `/tenants/${tenantId}/queue-setup/ai`, { method: 'POST', body: JSON.stringify({ messages }) }),
  /** Logs an ask from the chat for something that isn't an actual setting yet, for the platform admin to review at owner/setting-requests. */
  requestSetting: (tenantId: string, description: string) =>
    request(key, `/tenants/${tenantId}/queue-setup/request`, { method: 'POST', body: JSON.stringify({ description }) }),
  arrivalQr: (tenantId: string) => request<ArrivalQr>(key, `/tenants/${tenantId}/arrival-qr`),
  regenerateArrivalQr: (tenantId: string) => request<ArrivalQr>(key, `/tenants/${tenantId}/arrival-qr/regenerate`, { method: 'POST' }),
  setDaysOff: (doctorId: string, from: string, to: string) =>
    request(key, `/doctors/${doctorId}/sessions/days-off`, { method: 'POST', body: JSON.stringify({ from, to }) }),
  applyWeeklyTemplate: (doctorId: string, weeks: number, template: Record<string, { starts_at: string; ends_at: string; is_break: boolean }[]>) =>
    request(key, `/doctors/${doctorId}/sessions/weekly-template`, {
      method: 'POST',
      body: JSON.stringify({ weeks, template }),
    }),
  setSessionActive: (id: string, is_active: boolean) =>
    request<AdminSession>(key, `/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
  deleteSession: (id: string) => request(key, `/sessions/${id}`, { method: 'DELETE' }),
  users: (tenantId: string) => request<StaffLogin[]>(key, `/tenants/${tenantId}/users`),
  createUser: (
    tenantId: string,
    body: { role: 'reception' | 'doctor' | 'owner'; name: string; username: string; mobile_number: string; doctor_id?: string | null; is_owner?: boolean },
  ) => request<StaffLogin & StaffLinkResult>(key, `/tenants/${tenantId}/users`, { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name?: string; is_active?: boolean; password?: string; mobile_number?: string | null; is_owner?: boolean }) =>
    request<StaffLogin>(key, `/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resetPassword: (id: string) =>
    request<StaffLinkResult>(key, `/users/${id}/reset-password`, { method: 'POST' }),
  setupLink: (id: string) => request<StaffLinkResult>(key, `/users/${id}/setup-link`, { method: 'POST' }),
  deleteUser: (id: string) => request(key, `/users/${id}`, { method: 'DELETE' }),
  qrCodes: (status?: string) => request<QrCodeView[]>(key, `/qr-codes${status ? `?status=${status}` : ''}`),
  /** Always says who they're for: { doctor_id }, { tenant_id } (whole clinic), or both null (unassigned, print ahead). */
  createQrCodes: (count: number, label: string, target: { doctor_id: string | null; tenant_id: string | null }) =>
    request<QrCodeView[]>(key, '/qr-codes', { method: 'POST', body: JSON.stringify({ count, label, ...target }) }),
  updateQrCode: (id: string, body: { doctor_id?: string | null; tenant_id?: string | null; status?: 'disabled' | 'active' }) =>
    request<QrCodeView>(key, `/qr-codes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  leads: () => request<TrialLead[]>(key, '/leads'),
  setLeadStatus: (id: string, status: TrialLeadStatus) =>
    request<TrialLead>(key, `/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  moduleRequests: () => request<ModuleRequest[]>(key, '/module-requests'),
  setModuleRequestStatus: (id: string, status: 'pending' | 'approved' | 'denied') =>
    request<ModuleRequest>(key, `/module-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  /** Super-only — asks from the Queue Setup AI chat for something not yet configurable. */
  settingRequests: () => request<SettingRequest[]>(key, '/setting-requests'),
  setSettingRequestStatus: (id: string, status: 'pending' | 'done' | 'dismissed') =>
    request<SettingRequest>(key, `/setting-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Referral partners (Decision 27) — super admin
  referrers: () => request<ReferrerSummary[]>(key, '/referrers'),
  referrer: (id: string) => request<ReferrerDetail>(key, `/referrers/${id}`),
  createReferrer: (body: { name: string; email: string; mobile_number?: string } & ReferrerRates) =>
    request<{ referrer: ReferrerDetail; password: string }>(key, '/referrers', { method: 'POST', body: JSON.stringify(body) }),
  updateReferrer: (id: string, body: Partial<ReferrerRates & ReferrerBank & { name: string; mobile_number: string | null; is_active: boolean; notes: string | null }>) =>
    request<ReferrerDetail>(key, `/referrers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resetReferrerPassword: (id: string) => request<{ password: string }>(key, `/referrers/${id}/reset-password`, { method: 'POST' }),
  assignReferrerClinic: (id: string, tenantId: string) =>
    request<ReferrerDetail>(key, `/referrers/${id}/clinics`, { method: 'POST', body: JSON.stringify({ tenant_id: tenantId }) }),
  unassignReferrerClinic: (id: string, tenantId: string) => request<ReferrerDetail>(key, `/referrers/${id}/clinics/${tenantId}`, { method: 'DELETE' }),
  setReferrerClinicRates: (id: string, tenantId: string, body: { one_time_inr?: number | null; monthly_inr?: number | null }) =>
    request<ReferrerDetail>(key, `/referrers/${id}/clinics/${tenantId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  recordReferrerPayout: (id: string, body: { amount_inr: number; method: PayoutMethod; reference?: string }) =>
    request<ReferrerDetail>(key, `/referrers/${id}/payouts`, { method: 'POST', body: JSON.stringify(body) }),
  voidReferralEarning: (earningId: string, reason?: string) =>
    request<ReferrerDetail>(key, `/referral-earnings/${earningId}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
  accrueReferrals: () => request<{ created: number }>(key, '/referrers/accrue', { method: 'POST' }),
  // …and the referrer's own page
  myEarnings: () => request<ReferrerDetail>(key, '/me/earnings'),
  updateMyBank: (body: Partial<ReferrerBank>) => request<ReferrerDetail>(key, '/me/bank', { method: 'PATCH', body: JSON.stringify(body) }),
});

export type AdminApi = ReturnType<typeof adminApi>;

/** Platform admin sign-in (email + password → httpOnly session cookie). */
async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/owner-auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => null);
    throw new ApiError(res.status, typeof b?.message === 'string' ? b.message : `Request failed (${res.status})`);
  }
  return res.json();
}

export interface PlatformAdminMe {
  email: string;
  name: string;
  /** Decision 27: 'referrer' = referral partner — only their own clinics, setup only. */
  role: 'super' | 'referrer';
}

// ---------- Referral partners (Decision 27) ----------
export type PayoutFrequency = 'weekly' | 'monthly';
export type PayoutMethod = 'bank' | 'upi' | 'cash';

export interface ReferrerBank {
  account_holder: string | null;
  account_number: string | null;
  ifsc: string | null;
  bank_name: string | null;
  upi_id: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface ReferrerRates {
  one_time_inr: number;
  monthly_inr: number;
  payout_frequency: PayoutFrequency;
  /** monthly: day 1–28; weekly: 1 = Monday … 7 = Sunday */
  payout_day: number;
}

export interface ReferrerSummary extends ReferrerRates {
  id: string;
  name: string;
  email: string;
  mobile_number: string | null;
  is_active: boolean;
  last_login_at: string | null;
  clinics: number;
  earned_inr: number;
  paid_inr: number;
  balance_inr: number;
  next_payout: string;
}

export interface ReferralEarningRow {
  id: string;
  tenant_id: string;
  clinic_name: string;
  kind: 'one_time' | 'monthly';
  period: string;
  amount_inr: number;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface ReferralPayoutRow {
  id: string;
  amount_inr: number;
  method: PayoutMethod;
  reference: string | null;
  recorded_by: string;
  paid_at: string;
}

export interface ReferrerDetail extends Omit<ReferrerSummary, 'clinics'> {
  notes?: string | null;
  bank: ReferrerBank;
  clinics: {
    id: string;
    name: string;
    subdomain: string;
    subscription: SubscriptionStatus;
    one_time_inr: number | null;
    monthly_inr: number | null;
    created_at: string;
  }[];
  earnings: ReferralEarningRow[];
  payouts: ReferralPayoutRow[];
}

export const platformAuth = {
  me: () => authRequest<PlatformAdminMe>('/me'),
  login: (email: string, password: string) => authRequest<PlatformAdminMe>('/login', { email, password }),
  logout: () => authRequest<{ ok: true }>('/logout', {}),
};
