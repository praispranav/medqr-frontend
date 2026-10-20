import { ApiError, type ClinicGatewayView, type SetupView, type PayoutView, type SupportRequest, type SupportStatus, type ArrivalQr, type DoctorSession, type Entitlements, type HoursSlot, type HoursWeek, type QrCodeView, type QueueSettings, type QueueSetupMessage, type QueueSetupTurn, type StaffLinkResult, type Tenant, type TokenStatus } from '@/lib/api';

import { apiBase } from '@/lib/clinicHost';

/** Old key-in-the-browser storage — cleared on sign-in; the admin panel now uses an email + password login. */
export const ADMIN_KEY_STORAGE = 'medqr:admin-key';

/**
 * Platform admin requests ride on the httpOnly `medqr_admin_session` cookie (credentials:
 * 'include'). `key` is only for scripts that still use ADMIN_API_KEY; the web panel passes ''.
 */
async function request<T>(key: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/owner${path}`, {
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

export interface AdminReview {
  id: string;
  tenant_id: string;
  clinic_name: string | null;
  clinic_code: string | null;
  display_name: string;
  mobile: string;
  rating: number;
  text: string | null;
  status: 'published' | 'held' | 'removed';
  hold_reason: string | null;
  created_at: string;
}

export interface ChangeRequestView {
  id: string;
  tenant_id: string;
  target: 'clinic_profile' | 'doctor_profile' | 'doctor';
  target_id: string | null;
  patch: Record<string, unknown>;
  reason: string;
  requested_by: string | null;
  status: 'pending' | 'applied' | 'rejected';
  created_at: string;
  clinic_name: string | null;
  doctor_name: string | null;
}

export interface ListingClaimView {
  id: string;
  kind: 'claim' | 'remove' | 'signup' | 'join';
  status: 'new' | 'approved' | 'rejected';
  name: string;
  mobile: string;
  email: string | null;
  role: 'owner' | 'doctor' | 'manager' | 'other';
  message: string | null;
  admin_note: string | null;
  created_at: string;
  decided_at: string | null;
  tenant_id: string;
  clinic_name: string | null;
  clinic_code: string | null;
  clinic_listed: boolean;
  doctor_name: string | null;
  documents: { kind: 'id_proof' | 'registration' | 'clinic_proof'; name: string; mimetype: string; size: number; index: number }[];
}

export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'grace' | 'read_only'; // 'free' = Decision 59

export interface SubscriptionStatusView {
  status: SubscriptionStatus;
  /** Decision 59: a free clinic asked for a free trial of the paid plan. */
  trial_requested_at?: string | null;
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

/** Decision 73 — Owner › API usage. */
export interface UsageTotals { calls: number; errors: number; units: number; cost_usd: number }
export interface ApiUsageService {
  key: string;
  label: string;
  purpose: string;
  configured: boolean;
  live: { remaining: string | null; low: boolean; detail?: string; error?: string } | null;
  today: UsageTotals;
  last7: UsageTotals;
  last30: UsageTotals;
  operations: ({ operation: string } & UsageTotals)[];
  daily: { day: string; calls: number }[];
}
export interface ApiUsageOverview { as_of: string; tracked_since: string; services: ApiUsageService[] }

/** Decision 67 — a doctor the details agent looked up, waiting for the owner's Confirm. */
export interface DoctorEnrichment {
  id: string;
  doctor_name: string;
  address: string;
  city: string | null;
  status: 'queued' | 'searching' | 'review' | 'inactive' | 'not_found' | 'applied' | 'failed';
  found: { specialty: string | null; qualification: string | null; experience_years: number | null; consultation_fee_inr: number | null; timings: string | null; bio: string | null; website?: string | null; socials?: Partial<Record<'facebook' | 'instagram' | 'youtube' | 'linkedin', string>> } | null;
  sources: { site: string; url: string; title: string }[];
  practising: 'yes' | 'no' | 'unknown' | null;
  note: string | null;
  agreeing_sites: number;
  error: string | null;
}

/** Decision 60 — a Google Maps listing waiting in Owner › Clinic listings. */
export interface ListingCandidate {
  submitted_by?: string | null;
  doctor_name?: string | null;
  id: string;
  place_id: string;
  title: string;
  category: string | null;
  categories: string[];
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  maps_url: string | null;
  search_term: string | null;
  status: 'pending' | 'imported';
  tenant_id: string | null;
}

export interface ListingImportResult {
  imported: number;
  failed: number;
  results: { id: string; ok: boolean; tenant_id?: string; subdomain?: string; error?: string }[];
}

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
  subscription?: { status: SubscriptionStatus; trial_ends_at: string | null; grace_ends_at: string | null; trial_requested_at?: string | null };
  /** Decision 27: the referral partner who looks after this clinic, if any. */
  referrer_id?: string | null;
  /** Decision 47: % of the setup checklist done (null for the demo clinic). */
  setup_percent?: number | null;
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

/** Forwarded to Razorpay for the doctor's linked account; the backend does not store it. */
export interface PayoutKyc {
  legal_name: string;
  pan: string;
  email: string;
  phone: string;
  gst?: string;
  address: { street1: string; street2?: string; city: string; state: string; postal_code: string };
  bank: { account_number: string; ifsc: string; beneficiary_name?: string };
}

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
  // Decision 64 — claim / removal requests (super admin).
  // Decision 75 — clinic reviews (held by the check, or any review to remove).
  reviews: (status: string) => request<AdminReview[]>(key, `/reviews?status=${encodeURIComponent(status)}`),
  setReviewStatus: (id: string, publish: boolean) => request<AdminReview>(key, `/reviews/${id}/${publish ? 'publish' : 'remove'}`, { method: 'POST' }),
  // Decision 67 — clinic edits held by the content check.
  changeRequests: (status: string) => request<ChangeRequestView[]>(key, `/change-requests?status=${encodeURIComponent(status)}`),
  decideChangeRequest: (id: string, apply: boolean) => request<ChangeRequestView>(key, `/change-requests/${id}/${apply ? 'apply' : 'reject'}`, { method: 'POST' }),
  claims: (status: string) => request<ListingClaimView[]>(key, `/claims?status=${encodeURIComponent(status)}`),
  decideClaim: (id: string, approve: boolean, note?: string) =>
    request<ListingClaimView & { login?: { username: string; setup_link: string; whatsapp: string } }>(key, `/claims/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', body: JSON.stringify({ note }) }),
  claimDocumentUrl: (id: string, index: number) => `${apiBase()}/owner/claims/${id}/documents/${index}`,
  /** One page of Owner › Clinics (search + product filter), so 1,000+ clinics never load at once. */
  tenantsPage: (opts: { q?: string; product?: string; limit: number; offset: number }) =>
    request<AdminTenant[]>(key, `/tenants?${new URLSearchParams(Object.entries(opts).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()}`),
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
      maps_url?: string | null;
      /** Decision 42 — super admin only: custom monthly base-plan price for this clinic. Null clears it. */
      base_plan_override_inr?: number | null;
      queue_settings?: Partial<QueueSettings>;
      /** Decision 60 — super admin only. */
      subdomain?: string;
      public_booking?: 'auto' | 'on' | 'off'; directory_products?: string[]; verified?: boolean;
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
  // Decision 45: the clinic's OWN Razorpay account (API keys) — super admin can paste them on the clinic's behalf
  gateway: (tenantId: string) => request<ClinicGatewayView>(key, `/tenants/${tenantId}/gateway`),
  connectGateway: (tenantId: string, key_id: string, key_secret: string) =>
    request<ClinicGatewayView>(key, `/tenants/${tenantId}/gateway`, { method: 'PUT', body: JSON.stringify({ key_id, key_secret }) }),
  gatewayKycPending: (tenantId: string) => request<ClinicGatewayView>(key, `/tenants/${tenantId}/gateway/kyc-pending`, { method: 'POST' }),
  disconnectGateway: (tenantId: string) => request<ClinicGatewayView>(key, `/tenants/${tenantId}/gateway`, { method: 'DELETE' }),
  // Decision 47: setup checklist (admin + referrer)
  landingDraft: (tenantId: string) => request<{ tagline: string; about: string; highlights: string[] }>(key, `/tenants/${tenantId}/landing-draft`, { method: 'POST' }),
  bioDraft: (doctorId: string) => request<{ bio: string }>(key, `/doctors/${doctorId}/bio-draft`, { method: 'POST' }),
  tenantSetup: (tenantId: string) => request<SetupView | null>(key, `/tenants/${tenantId}/setup`),
  confirmDoctorSetup: (doctorId: string, item: 'hours' | 'fee' | 'hours_na' | 'fee_na') =>
    request<SetupView | null>(key, `/doctors/${doctorId}/setup/confirm`, { method: 'POST', body: JSON.stringify({ item }) }),
  // Decision 44: Razorpay Route payout accounts (super admin only; dormant)
  payoutAccount: (doctorId: string) => request<PayoutView>(key, `/doctors/${doctorId}/payout-account`),
  createPayoutAccount: (doctorId: string, kyc: PayoutKyc) =>
    request<PayoutView>(key, `/doctors/${doctorId}/payout-account`, { method: 'POST', body: JSON.stringify(kyc) }),
  linkPayoutAccount: (doctorId: string, account_id: string) =>
    request<PayoutView>(key, `/doctors/${doctorId}/payout-account/link`, { method: 'POST', body: JSON.stringify({ account_id }) }),
  refreshPayoutAccount: (doctorId: string) => request<PayoutView>(key, `/doctors/${doctorId}/payout-account/refresh`, { method: 'POST' }),
  retryPayoutTransfers: (doctorId: string) => request<{ retried: number }>(key, `/doctors/${doctorId}/payout-account/retry-transfers`, { method: 'POST' }),
  unlinkPayoutAccount: (doctorId: string) => request<PayoutView>(key, `/doctors/${doctorId}/payout-account`, { method: 'DELETE' }),
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
  /** The main "scan to join" QR standee (whole clinic or one doctor) — distinct from the arrival QR above. */
  tenantQrCodes: (tenantId: string) => request<QrCodeView[]>(key, `/tenants/${tenantId}/qr-codes`),
  createTenantQrCode: (tenantId: string, body: { doctor_id?: string; whole_clinic?: boolean }) =>
    request<QrCodeView[]>(key, `/tenants/${tenantId}/qr-codes`, { method: 'POST', body: JSON.stringify(body) }),
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
  supportRequests: () => request<SupportRequest[]>(key, '/support'),
  updateSupport: (id: string, patch: { status?: SupportStatus; reply?: string | null }) =>
    request<SupportRequest>(key, `/support/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  submitListing: (body: Record<string, unknown>) => request<{ added: number; already_there: number }>(key, '/listings/submit', { method: 'POST', body: JSON.stringify(body) }),
  directoryProducts: () => request<{ key: string; name: string }[]>(key, '/directory-products'),
  createDirectoryProduct: (body: { key: string; name: string }) => request<{ key: string; name: string }>(key, '/directory-products', { method: 'POST', body: JSON.stringify(body) }),
  listings: () => request<ListingCandidate[]>(key, '/listings'),
  enrichClinicDoctors: (tenantId: string) => request<{ queued: number }>(key, '/doctor-enrich/clinic', { method: 'POST', body: JSON.stringify({ tenant_id: tenantId }) }),
  apiUsage: () => request<ApiUsageOverview>(key, '/api-usage'),
  doctorEnrichCredits: () => request<{ balance: number | null; per_doctor: number }>(key, '/doctor-enrich/credits'),
  doctorEnrich: () => request<DoctorEnrichment[]>(key, '/doctor-enrich'),
  addDoctorEnrich: (items: { name: string; address: string; city?: string }[]) => request<{ added: number; skipped: number }>(key, '/doctor-enrich', { method: 'POST', body: JSON.stringify({ items }) }),
  editDoctorEnrich: (id: string, patch: Partial<NonNullable<DoctorEnrichment['found']>>) => request<DoctorEnrichment>(key, `/doctor-enrich/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  retryDoctorEnrich: (ids: string[]) => request<{ queued: number }>(key, '/doctor-enrich/retry', { method: 'POST', body: JSON.stringify({ ids }) }),
  applyDoctorEnrich: (ids: string[]) => request<{ applied: number; failed: number; results: { id: string; ok: boolean; error?: string }[] }>(key, '/doctor-enrich/apply', { method: 'POST', body: JSON.stringify({ ids }) }),
  deleteDoctorEnrich: (ids: string[]) => request<{ deleted: number }>(key, '/doctor-enrich/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  uploadListings: (items: Record<string, unknown>[]) =>
    request<{ added: number; already_there: number; closed_skipped: number; excluded_skipped?: number }>(key, '/listings/upload', { method: 'POST', body: JSON.stringify({ items }) }),
  importListings: (ids: string[]) => request<ListingImportResult>(key, '/listings/import', { method: 'POST', body: JSON.stringify({ ids }) }),
  deleteListings: (ids: string[]) => request<{ deleted: number }>(key, '/listings/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
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
  createReferrer: (body: { role?: 'referrer' | 'marketer'; name: string; email: string; mobile_number?: string } & ReferrerRates) =>
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
  const res = await fetch(`${apiBase()}/owner-auth${path}`, {
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
  role: 'super' | 'referrer' | 'marketer';
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
  compensation_basis?: 'per_clinic' | 'salary';
  per_clinic_inr?: number;
  salary_inr?: number;
  one_time_inr: number;
  monthly_inr: number;
  payout_frequency: PayoutFrequency;
  /** monthly: day 1–28; weekly: 1 = Monday … 7 = Sunday */
  payout_day: number;
}

export interface ReferrerSummary extends ReferrerRates {
  role: 'referrer' | 'marketer';
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
  kind: 'one_time' | 'monthly' | 'listing' | 'salary';
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
