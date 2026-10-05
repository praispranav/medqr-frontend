const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ---- Patient phone verification (WhatsApp OTP): the device keeps a signed token for 90 days ----
const PATIENT_TOKEN_KEY = 'medqr:patient-token';
const PATIENT_MOBILE_KEY = 'medqr:mobile';

export const patientDevice = {
  get(): { token: string; mobile: string } | null {
    try {
      const token = localStorage.getItem(PATIENT_TOKEN_KEY);
      const mobile = localStorage.getItem(PATIENT_MOBILE_KEY);
      return token && mobile ? { token, mobile } : null;
    } catch {
      return null;
    }
  },
  set(token: string, mobile: string) {
    try {
      localStorage.setItem(PATIENT_TOKEN_KEY, token);
      localStorage.setItem(PATIENT_MOBILE_KEY, mobile);
    } catch {
      /* private mode: verified for this visit only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(PATIENT_TOKEN_KEY);
      localStorage.removeItem(PATIENT_MOBILE_KEY);
    } catch {
      /* ignore */
    }
  },
};

function toQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const patientToken = typeof window !== 'undefined' ? patientDevice.get()?.token : undefined;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(patientToken ? { 'x-patient-token': patientToken } : {}) },
    credentials: 'include', // staff session cookie (httpOnly, set by POST /auth/login)
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, typeof body?.message === 'string' ? body.message : `API ${path} failed: ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export type PaymentMode = 'cash_at_counter' | 'prepay_remote_only' | 'prepay_always' | 'pay_after_consultation';

export type BookingMode = 'token' | 'time_slot' | 'hybrid';
/** Who calls patients in: 'manual' = the doctor, 'reception' = the front desk only, 'both' = either. */
export type AdvanceMode = 'manual' | 'auto_timer' | 'reception' | 'both';
export type NoShowAction = 'skip_to_end' | 'push_back' | 'notify_and_hold';

export interface QueueSettings {
  avg_consult_mins: number;
  max_daily_tokens: number;
  booking_mode: BookingMode;
  hybrid_ratio?: { booked: number; walk_in: number };
  advance_mode: AdvanceMode;
  auto_advance_after_mins: number | null;
  no_show_grace_mins: number;
  no_show_action: NoShowAction;
  priority_tags: string[];
  /** Decision 2 */
  print_slip_on_checkin: boolean;
  /** Decision 8 */
  payment_mode: PaymentMode;
  default_consultation_fee_inr: number;
  /** Decision 10: doctor lets patients pay online (UPI QR). Missing = true. */
  offer_online_payment?: boolean;
  /** Require WhatsApp OTP before patient self check-in (doctor or admin). Missing = false. */
  require_whatsapp_otp?: boolean;
  /** 'manual' = doctor taps Start shift (default), 'auto' = planned consulting hours. */
  shift_start_mode?: 'manual' | 'auto';
  /** Decision 17: how many days ahead a patient may book (0/missing = today only). Still needs an actual scheduled session that day. */
  advance_booking_days?: number;
  /** Decision 19 */
  front_desk_verifies_arrivals?: boolean;
  /** Decision 21: with no front desk, patients confirm arrival by scanning the clinic's arrival QR. */
  arrival_scan_required?: boolean;
  late_arrival_priority?: 'keep_position' | 'insert_after_n' | 'back_of_queue';
  late_arrival_insert_after?: number;
}

export interface Entitlements {
  base_plan_active: boolean;
  custom_forms: boolean;
  smart_print: boolean;
  prescription_ocr: boolean;
  prescription_image_to_text: boolean;
  advance_booking: boolean;
  [key: string]: boolean;
}

export interface Tenant {
  id: string;
  subdomain: string;
  display_name: string | null;
  wallet_balance_inr: string;
  entitlements: Entitlements;
  queue_settings: QueueSettings;
  /** The permanent "See the doctor suite" demo clinic — always read-only (Decision 18). */
  is_demo?: boolean;
  /** Public doctor/clinic directory (medqr.in/doctors) — off by default, platform admin opts a clinic in. */
  is_publicly_listed?: boolean;
  city?: string | null;
  address?: string | null;
  public_phone?: string | null;
  public_slug?: string | null;
}

/** Decision 6 — today-only, four states. */
export type DoctorTodayStatus = 'available' | 'on_break' | 'starts_later_today' | 'off_today';

export interface NextSession {
  date: string;
  starts_at: string;
  bookable: boolean;
}

export interface DoctorToday {
  id: string;
  name: string;
  qualification: string | null;
  specialty: string | null;
  cabin_label: string | null;
  photo_url: string | null;
  today_status: DoctorTodayStatus;
  today_status_detail: string;
  /** Decision 6 (amended): off-today doctors only — their next planned session; bookable only inside the advance-booking window. */
  next_session?: NextSession | null;
  bio?: string | null;
  is_publicly_listed?: boolean;
  intake_schema?: any;
  public_slug?: string | null;
  /** Decision 24: WhatsApp shift alerts to the doctor. */
  shift_alert_before?: boolean;
  shift_alert_minutes?: number;
  shift_alert_at_start?: boolean;
  notify_token_confirmed?: boolean;
  notify_you_are_next?: boolean;
  notify_your_turn?: boolean;
  notify_location_override?: string | null;
}

export interface Patient {
  id: string;
  mobile_number: string;
  name: string;
  relation: string | null;
  age: number | null;
  gender: string | null;
  allergies?: string[];
}

export type PaymentMethod = 'cash' | 'upi_counter' | 'upi_online';
export type PaymentChoice = 'online' | 'cash';

export interface PaymentQrView {
  id: string;
  amount_inr: number;
  upi_uri: string;
  image_url: string | null;
  close_by: string;
  status: 'active' | 'paid' | 'abandoned' | 'expired';
  gateway: 'razorpay' | 'mock';
}

export interface PatientPaymentStatus {
  token_number: number;
  token_status: TokenStatus;
  fee_inr: number;
  is_paid: boolean;
  payment_method: PaymentMethod | null;
  payment_choice: PaymentChoice | null;
  payment_mode: PaymentMode;
  online_available: boolean;
  gateway: 'razorpay' | 'mock';
  qr: PaymentQrView | null;
}

export interface PaymentEvent {
  id: string;
  visit_id: string;
  doctor_id: string;
  doctor_name?: string | null;
  token_number: number;
  patient_name: string | null;
  type:
    | 'choice_online'
    | 'choice_cash'
    | 'qr_created'
    | 'qr_abandoned'
    | 'qr_expired'
    | 'paid_online'
    | 'marked_paid'
    | 'unmarked_paid'
    | 'fee_changed'
    | 'duplicate_payment';
  amount_inr: string | null;
  method: string | null;
  actor_type: 'patient' | 'reception' | 'doctor' | 'system' | 'razorpay';
  actor_name: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
}

export interface PaymentReport {
  date: string;
  summary: {
    visits: number;
    paid: number;
    cash_inr: number;
    upi_counter_inr: number;
    online_inr: number;
    unpaid_count: number;
    unpaid_inr: number;
    duplicate_payments: number;
  };
  by_doctor: {
    doctor_id: string;
    doctor_name: string;
    visits: number;
    paid: number;
    cash_inr: number;
    upi_counter_inr: number;
    online_inr: number;
  }[];
  /** Cash handover: what each staff member marked collected at the counter (undo subtracts). */
  collected_by_staff: { name: string; cash_inr: number; upi_counter_inr: number }[];
  unpaid: {
    visit_id: string;
    token_id: string | null;
    token_number: number;
    token_status: TokenStatus | null;
    patient_name: string;
    doctor_name: string;
    amount_inr: number;
    payment_choice: PaymentChoice | null;
  }[];
  events: PaymentEvent[];
}

export type TokenStatus = 'booked' | 'waiting_in_clinic' | 'checked_in_early' | 'in_consultation' | 'done' | 'no_show' | 'expired' | 'cancelled';

export interface TokenStatusView {
  id: string;
  token_number: number;
  status: TokenStatus;
  visit_id: string | null;
  patient_name: string | null;
  doctor: Pick<DoctorToday, 'id' | 'name' | 'qualification' | 'specialty' | 'cabin_label' | 'photo_url'>;
  clinic: { name: string; subdomain: string };
  now_serving: number | null;
  ahead_tokens: number[];
  avg_consult_mins: number;
  session_starts_at: string | null;
  doctor_state: { state: ShiftState; detail: string; mode: 'manual' | 'auto' };
  /** Decision 17 — booked for a future date, not today; there's no live shift state yet. */
  is_future_booking: boolean;
  booking_date: string | null;
  /** Decision 19: false when the clinic runs without a reception desk. */
  front_desk: boolean;
  /** Decision 21: confirm arrival by scanning the clinic's arrival QR. */
  arrival_scan: boolean;
  /** Firebase push is configured on the server / turned on for this token's phone. */
  push_available: boolean;
  push_enabled: boolean;
}

/** Decision 17 — one bookable future day: the doctors who actually have a scheduled session on it. */
export interface AdvanceBookingDay {
  date: string;
  doctors: Pick<DoctorToday, 'id' | 'name' | 'qualification' | 'specialty' | 'cabin_label' | 'photo_url'>[];
}

export type ShiftState = 'not_started' | 'live' | 'on_break' | 'ended';

export interface ShiftView {
  doctor_id: string;
  mode: 'manual' | 'auto';
  state: ShiftState;
  today_status: DoctorTodayStatus;
  today_status_detail: string;
  planned_start: string | null;
  started_at: string | null;
  started_by: string | null;
  on_break_since: string | null;
  break_after_patients: number | null;
  ended_at: string | null;
  /** Decision 16: manual mode, not started, running late — "I'll start by…" (30 min per tap). */
  delayed_until: string | null;
  can_delay: boolean;
}

/** One consulting (or break) block on a day, as My Hours edits it. */
export interface HoursSlot {
  starts_at: string; // 'HH:MM'
  ends_at: string;
  is_break: boolean;
}

/** Seven days of a doctor's hours, for the My Hours week view. `off` = deliberately off (not just unset). */
export interface HoursWeek {
  today: string;
  days: { date: string; off: boolean; sessions: DoctorSession[] }[];
}

/** Reminder banner: does today / tomorrow have consulting hours, and is the doctor deliberately off? */
export interface HoursStatus {
  today: { date: string; has_hours: boolean; off: boolean };
  tomorrow: { date: string; has_hours: boolean; off: boolean };
}

/** Decision 21: the clinic's one arrival QR. */
export interface ArrivalQr {
  code: string;
  url: string;
  clinic_name: string;
  subdomain: string;
  /** Front desk off and arrival scan on — patients must scan it. */
  required: boolean;
}

export interface DoctorSession {
  id: string;
  doctor_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  is_break: boolean;
  is_active: boolean;
}

export interface Vitals {
  bp_systolic?: number;
  bp_diastolic?: number;
  weight_kg?: number;
  height_cm?: number;
  temp_f?: number;
  spo2_percent?: number;
}

export interface VisitAttachment {
  url: string;
  uploaded_by: 'doctor' | 'reception' | 'patient';
  uploaded_at: string;
  name?: string;
}

export interface Visit {
  id: string;
  tenant_id: string;
  doctor_id: string;
  patient_id: string;
  token_number: number;
  visit_date: string;
  chief_complaint: string | null;
  intake_answers: Record<string, string | string[] | boolean> | null;
  note: string | null;
  attachments: VisitAttachment[];
  vitals: Vitals | null;
  consultation_fee_inr: string | null;
  is_paid: boolean;
  payment_method: PaymentMethod | null;
  payment_choice: PaymentChoice | null;
}

export interface QueueRow {
  id: string;
  token_number: number;
  status: TokenStatus;
  joined_at: string;
  called_at: string | null;
  doctor: { id: string; name: string; cabin_label: string | null };
  patient: { id: string; name: string; age: number | null; gender: string | null; mobile_number: string } | null;
  visit: Pick<Visit, 'id' | 'chief_complaint' | 'intake_answers' | 'vitals' | 'is_paid' | 'consultation_fee_inr' | 'payment_method' | 'payment_choice'> | null;
}

export interface CatalogAddOn {
  key: string;
  name: string;
  price_inr_per_month: number;
  ai_badge?: boolean;
}

export const fileUrl = (url: string) => (url.startsWith('/') ? `${API_BASE}${url}` : url);

async function uploadFile(file: File) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API_BASE}/uploads`, { method: 'POST', body, credentials: 'include' });
  if (!res.ok) throw new Error(res.status === 413 ? 'File is larger than 15 MB' : 'Upload failed');
  return (await res.json()) as { url: string; name: string };
}

export type StaffRole = 'reception' | 'doctor' | 'owner';

export interface Me {
  user: {
    id: string;
    name: string;
    username: string;
    role: StaffRole;
    doctor_id: string | null;
    /** Decision 14: clinic admin — a separate owner login, or a doctor given owner access. */
    is_owner: boolean;
    /** Billing, add-ons and clinic-wide Queue Rules: the solo doctor, or the clinic admin. */
    can_manage_clinic: boolean;
    /** Decision 15: a random password (creation, or an admin reset) forces a change before anything else. */
    must_change_password: boolean;
  };
  doctor_count: number;
  tenant: { id: string; subdomain: string; display_name: string | null };
}

export interface MonthlyPlan {
  doctor_count: number;
  included_doctors: number;
  extra_doctors: number;
  extra_doctor_price_inr: number;
  lines: { label: string; amount_inr: number }[];
  total_inr_per_month: number;
  wallet_balance_inr: number;
}

// Public doctor/clinic directory (medqr.in/doctors)
export interface DirectoryDoctorSummary {
  slug: string;
  name: string;
  qualification: string | null;
  specialty: string | null;
  photo_url: string | null;
  clinic_name: string | null;
  city: string | null;
}

export interface DirectoryDoctorProfile extends DirectoryDoctorSummary {
  id: string;
  bio: string | null;
  clinic_subdomain: string;
  address: string | null;
  public_phone: string | null;
}

export interface DirectoryClinicProfile {
  clinic_name: string | null;
  subdomain: string;
  city: string | null;
  address: string | null;
  public_phone: string | null;
  doctors: { id: string; slug: string; name: string; qualification: string | null; specialty: string | null; photo_url: string | null; bio: string | null }[];
}

export interface SubscriptionStatus {
  status: 'trial' | 'active' | 'grace' | 'read_only';
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  autopay_active: boolean;
  wallet_auto_recharge_enabled: boolean;
  wallet_auto_recharge_below_inr: number;
  wallet_auto_recharge_amount_inr: number;
}

export interface ManageOverview {
  date: string;
  totals: {
    doctors: number;
    on_shift: number;
    tokens: number;
    waiting: number;
    done: number;
    no_show: number;
    collected_inr: number;
    cash_inr: number;
    upi_counter_inr: number;
    online_inr: number;
    unpaid: number;
  };
  doctors: {
    doctor_id: string;
    doctor_name: string;
    /** Decision 21: no consulting hours today and not deliberately off — nudge them. */
    needs_hours_today: boolean;
    mobile: string | null;
    specialty: string | null;
    cabin_label: string | null;
    shift_state: ShiftState;
    today_status_detail: string;
    started_at: string | null;
    on_break_since: string | null;
    ended_at: string | null;
    tokens: number;
    waiting: number;
    in_cabin: boolean;
    done: number;
    no_show: number;
    cash_inr: number;
    upi_counter_inr: number;
    online_inr: number;
    unpaid: number;
  }[];
}

export interface ActivityItem {
  at: string;
  kind: 'payment' | 'shift' | 'patient' | 'staff';
  doctor_id: string | null;
  doctor_name: string | null;
  text: string;
  by: string | null;
  note?: string | null;
}

export interface QrCodeView {
  id: string;
  code: string;
  status: 'unassigned' | 'assigned' | 'disabled';
  label: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  created_at: string;
  scan_count?: number;
  last_scanned_at?: string | null;
  doctor: { id: string; name: string; cabin_label: string | null; specialty: string | null } | null;
  clinic: { id: string; subdomain: string; name: string } | null;
}

export interface QrResolve {
  code: string;
  status: 'unassigned' | 'assigned' | 'disabled';
  clinic?: { id: string; subdomain: string; name: string };
  /** null on an assigned code = whole-clinic QR (patients pick the doctor). */
  doctor?: { id: string; name: string; specialty: string | null; cabin_label: string | null; today_status: DoctorTodayStatus; today_status_detail: string } | null;
}

export const api = {
  // Standalone QR standees (/q/<code>) — created unassigned, linked by admin or by the doctor scanning it
  resolveQr: (code: string) => request<QrResolve>(`/qr/${encodeURIComponent(code)}`),
  claimQr: (code: string) => request<QrCodeView>('/qr-codes/claim', { method: 'POST', body: JSON.stringify({ code }) }),
  myQrCodes: () => request<QrCodeView[]>('/qr-codes/mine'),

  // Staff login (reception and doctors have separate accounts)
  login: (body: { clinic: string; username: string; password: string }) =>
    request<Me>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  demoLogin: () => request<Me>('/auth/demo-login', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<Me>('/auth/me'),
  /** Public, token-gated: whose set-password link this is (Decision 15). */
  setupInfo: (token: string) => request<SetupInfo>(`/auth/setup-info?token=${encodeURIComponent(token)}`),
  setupPassword: (body: { token: string; newPassword: string }) =>
    request<{ success: true } & LoginHints>('/auth/setup-password', { method: 'POST', body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<Me>('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  getMyTenant: () => request<Tenant>('/tenants/mine'),
  addPatientAttachment: (tokenId: string, file: { url: string; name: string }) =>
    request(`/queue/tokens/${tokenId}/attachments`, { method: 'POST', body: JSON.stringify(file) }),

  getTenantBySubdomain: (subdomain: string) => request<Tenant | null>(`/tenants/by-subdomain/${subdomain}`),
  getDoctorsToday: (tenantId: string) => request<DoctorToday[]>(`/doctors/tenant/${tenantId}/today`),
  // Decision 17 — advance booking window + which doctors have a session on each of the next N days.
  getAdvanceBooking: (tenantId: string) =>
    request<{ advance_booking_days: number; days: AdvanceBookingDay[] }>(`/doctors/tenant/${tenantId}/advance-booking`),
  // Patient WhatsApp OTP (Telnyx)
  sendOtp: (mobile_number: string) =>
    request<{ sent: boolean; expires_in_seconds: number; dev_code?: string }>('/patients/otp/send', { method: 'POST', body: JSON.stringify({ mobile_number }) }),
  verifyOtp: (mobile_number: string, code: string) =>
    request<{ patient_token: string; mobile_number: string }>('/patients/otp/verify', { method: 'POST', body: JSON.stringify({ mobile_number, code }) }),
  myProfiles: () => request<{ mobile_number: string; verified: boolean; profiles: Patient[] }>('/patients/me'),
  findOrCreatePatient: (body: {
    tenantId?: string;
    mobile_number: string;
    name: string;
    age?: number | null;
    gender?: string | null;
    whatsapp_updates?: boolean;
  }) => request<Patient & { device_token?: string | null }>('/patients', { method: 'POST', body: JSON.stringify(body) }),
  checkInRules: (tenantId: string) => request<{ require_whatsapp_otp: boolean }>(`/patients/check-in-rules/${tenantId}`),
  joinQueue: (body: {
    tenantId: string;
    doctorId: string;
    patientId: string;
    chief_complaint?: string | null;
    weight_kg?: number | null;
    /** Decision 17 — a future date, when the clinic's advance-booking window allows it. */
    bookingDate?: string;
    intake_answers?: Record<string, string | string[] | boolean> | null;
  }) => request<{ id: string; token_number: number; visit_id: string | null }>('/queue/join', { method: 'POST', body: JSON.stringify(body) }),
  getToken: (tokenId: string) => request<TokenStatusView>(`/queue/tokens/${tokenId}`),
  checkIn: (tokenId: string) => request(`/queue/tokens/${tokenId}/check-in`, { method: 'POST' }),
  callNext: (doctorId: string) => request<{ id: string } | null>(`/queue/doctors/${doctorId}/call-next`, { method: 'POST' }),
  callToken: (tokenId: string) => request(`/queue/tokens/${tokenId}/call`, { method: 'POST' }),
  markNoShow: (tokenId: string) => request(`/queue/tokens/${tokenId}/no-show`, { method: 'POST' }),
  /** Decision 26: take a patient out of the queue before their visit (reception / that doctor). */
  removeToken: (tokenId: string) => request(`/queue/tokens/${tokenId}/remove`, { method: 'POST' }),
  listQueueToday: (tenantId: string, doctorId?: string) =>
    request<QueueRow[]>(`/queue/tenant/${tenantId}/today${doctorId ? `?doctorId=${doctorId}` : ''}`),
  getVisit: (visitId: string) => request<{ visit: Visit; patient: Patient | null }>(`/patients/visits/${visitId}`),
  getPatientHistory: (patientId: string, tenantId: string) =>
    request<Visit[]>(`/patients/${patientId}/history?tenantId=${tenantId}`),
  saveVitals: (visitId: string, vitals: Vitals) =>
    request<Visit>(`/patients/visits/${visitId}/vitals`, { method: 'POST', body: JSON.stringify(vitals) }),
  saveNote: (visitId: string, note: string | null) =>
    request<Visit>(`/patients/visits/${visitId}/note`, { method: 'POST', body: JSON.stringify({ note }) }),
  addAttachment: (visitId: string, attachment: VisitAttachment) =>
    request<Visit>(`/patients/visits/${visitId}/attachments`, { method: 'POST', body: JSON.stringify(attachment) }),
  // Payments (Decisions 8–10)
  paymentStatus: (tokenId: string) => request<PatientPaymentStatus>(`/payments/tokens/${tokenId}`),
  choosePayment: (tokenId: string, choice: PaymentChoice) =>
    request<PatientPaymentStatus>(`/payments/tokens/${tokenId}/choice`, { method: 'POST', body: JSON.stringify({ choice }) }),
  paymentConfig: () => request<{ gateway: 'razorpay' | 'mock'; online_available: boolean }>('/payments/config'),
  staffQr: (visitId: string) => request<PaymentQrView>(`/payments/visits/${visitId}/qr`, { method: 'POST' }),
  markPaid: (visitId: string, method: 'cash' | 'upi_counter', amount_inr?: number) =>
    request<Visit>(`/payments/visits/${visitId}/mark-paid`, { method: 'POST', body: JSON.stringify({ method, amount_inr }) }),
  unmarkPaid: (visitId: string, reason: string) =>
    request<Visit>(`/payments/visits/${visitId}/unmark-paid`, { method: 'POST', body: JSON.stringify({ reason }) }),
  setFee: (visitId: string, amount_inr: number) =>
    request<Visit>(`/payments/visits/${visitId}/fee`, { method: 'POST', body: JSON.stringify({ amount_inr }) }),
  visitPaymentEvents: (visitId: string) => request<PaymentEvent[]>(`/payments/visits/${visitId}/events`),
  paymentReport: (date: string, opts: { all?: boolean; doctorId?: string } = {}) =>
    request<PaymentReport>(
      `/payments/report?date=${date}${opts.all ? '&scope=all' : ''}${opts.doctorId ? `&doctorId=${encodeURIComponent(opts.doctorId)}` : ''}`,
    ),
  simulateQrPayment: (qrId: string) => request(`/payments/dev/qr/${qrId}/simulate-paid`, { method: 'POST' }),
  // WhatsApp wallet self-recharge (solo doctor or clinic admin, Decision 14)
  createWalletRechargeQr: (amount_inr: number) =>
    request<PaymentQrView>('/payments/wallet/recharge-qr', { method: 'POST', body: JSON.stringify({ amount_inr }) }),
  walletRechargeStatus: (id: string) => request<PaymentQrView>(`/payments/wallet/recharge-qr/${id}`),
  simulateWalletRecharge: (id: string) => request(`/payments/dev/wallet-recharge/${id}/simulate-paid`, { method: 'POST' }),
  updateQueueSettings: (tenantId: string, patch: Partial<QueueSettings>) =>
    request<Tenant>(`/tenants/${tenantId}/queue-settings`, { method: 'PATCH', body: JSON.stringify(patch) }),
  // Public doctor/clinic directory (medqr.in/doctors) — clinic-wide fields: doctor/owner self-service (Decision 14).
  updateTenantPublicProfile: (
    tenantId: string,
    patch: { is_publicly_listed?: boolean; city?: string | null; address?: string | null; public_phone?: string | null },
  ) => request<Tenant>(`/tenants/${tenantId}/public-profile`, { method: 'PATCH', body: JSON.stringify(patch) }),
  // Per-doctor fields: the doctor's own login, or the clinic admin editing any doctor.
  updateDoctorPublicProfile: (
    doctorId: string,
    patch: { qualification?: string; specialty?: string; photo_url?: string; bio?: string; is_publicly_listed?: boolean; intake_schema?: any; notify_token_confirmed?: boolean; notify_you_are_next?: boolean; notify_your_turn?: boolean; notify_location_override?: string; shift_alert_before?: boolean; shift_alert_minutes?: number; shift_alert_at_start?: boolean },
  ) => request<DoctorToday & { bio: string | null; public_slug: string | null }>(`/doctors/${doctorId}/public-profile`, { method: 'PATCH', body: JSON.stringify(patch) }),
  // Doctor portal "My Hours"
  listSessions: (doctorId: string, date: string) => request<DoctorSession[]>(`/doctors/${doctorId}/sessions?date=${date}`),
  hoursStatus: (doctorId: string) => request<HoursStatus>(`/doctors/${doctorId}/hours-status`),
  // ---- My Hours week view ----
  hoursWeek: (doctorId: string, from: string) => request<HoursWeek>(`/doctors/${doctorId}/sessions/week?from=${from}`),
  setHoursDay: (doctorId: string, date: string, slots: HoursSlot[]) =>
    request(`/doctors/${doctorId}/sessions/day`, { method: 'POST', body: JSON.stringify({ date, slots }) }),
  arrivalQr: (tenantId: string) => request<ArrivalQr>(`/tenants/${tenantId}/arrival-qr`),
  regenerateArrivalQr: (tenantId: string) => request<ArrivalQr>(`/tenants/${tenantId}/arrival-qr/regenerate`, { method: 'POST' }),
  /** "Alert me when it's my turn": this phone's Firebase push token (null = stop). */
  /** "Add to Home Screen" hand-off: park this browser's patient keys under a one-time code (iPhone). */
  createHandoff: (data: Record<string, string>) =>
    request<{ code: string }>('/patients/handoff', { method: 'POST', body: JSON.stringify({ data }) }),
  redeemHandoff: (code: string) =>
    request<{ data: Record<string, string> }>('/patients/handoff/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  setTokenPush: (tokenId: string, fcm_token: string | null) =>
    request<{ push_enabled: boolean }>(`/queue/tokens/${tokenId}/push`, { method: 'POST', body: JSON.stringify({ fcm_token }) }),
  /** Decision 21 — patient: "I've arrived" with the code from the clinic's arrival QR. */
  arriveByScan: (tokenId: string, code: string) =>
    request<{ status: TokenStatus; already: boolean }>(`/queue/tokens/${tokenId}/arrive`, { method: 'POST', body: JSON.stringify({ code }) }),
  setDaysOff: (doctorId: string, from: string, to: string) =>
    request(`/doctors/${doctorId}/sessions/days-off`, { method: 'POST', body: JSON.stringify({ from, to }) }),
  addSession: (doctorId: string, body: { session_date: string; starts_at: string; ends_at: string; is_break: boolean }) =>
    request<DoctorSession>(`/doctors/${doctorId}/sessions`, { method: 'POST', body: JSON.stringify(body) }),
  repeatSessions: (doctorId: string, from_date: string, days: number) =>
    request<{ copied_to: string[] }>(`/doctors/${doctorId}/sessions/repeat`, { method: 'POST', body: JSON.stringify({ from_date, days }) }),
  getWeeklyTemplate: (doctorId: string) =>
    request<{ template: Record<string, { starts_at: string; ends_at: string; is_break: boolean }[]>; weeks: number; applied_until: string | null }>(
      `/doctors/${doctorId}/sessions/weekly-template`,
    ),
  applyWeeklyTemplate: (doctorId: string, weeks: number, template: Record<string, { starts_at: string; ends_at: string; is_break: boolean }[]>) =>
    request(`/doctors/${doctorId}/sessions/weekly-template`, { method: 'POST', body: JSON.stringify({ weeks, template }) }),
  setSessionActive: (doctorId: string, sessionId: string, is_active: boolean) =>
    request<DoctorSession>(`/doctors/${doctorId}/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
  deleteSession: (doctorId: string, sessionId: string) =>
    request(`/doctors/${doctorId}/sessions/${sessionId}`, { method: 'DELETE' }),
  // Doctor shift (outside My Hours): Start/End shift, open-ended breaks
  doctorShift: (doctorId: string) => request<ShiftView>(`/doctors/${doctorId}/shift`),
  clinicShifts: (tenantId: string) => request<(ShiftView & { doctor_name: string; cabin_label: string | null })[]>(`/queue/tenant/${tenantId}/shifts`),
  startShift: (doctorId: string) => request<ShiftView>(`/doctors/${doctorId}/shift/start`, { method: 'POST' }),
  endShift: (doctorId: string) => request<ShiftView>(`/doctors/${doctorId}/shift/end`, { method: 'POST' }),
  delayShift: (doctorId: string) => request<ShiftView>(`/doctors/${doctorId}/shift/delay`, { method: 'POST' }),
  startBreak: (doctorId: string, when: 'now' | 'after_current' | 'after_next') =>
    request<ShiftView>(`/doctors/${doctorId}/shift/break`, { method: 'POST', body: JSON.stringify({ when }) }),
  endBreak: (doctorId: string) => request<ShiftView>(`/doctors/${doctorId}/shift/break/end`, { method: 'POST' }),
  cancelBreak: (doctorId: string) => request<ShiftView>(`/doctors/${doctorId}/shift/break/cancel`, { method: 'POST' }),
  uploadFile,
  getBillingCatalog: () =>
    request<{ base_plan_price_inr: number; included_doctors: number; extra_doctor_price_inr: number; add_ons: CatalogAddOn[]; trial_days: number }>(
      '/billing/catalog',
    ),
  // Public landing page "Start free trial" lead form (Decision 18) — never creates a tenant by itself.
  submitTrialLead: (body: { clinic_name: string; contact_name: string; phone: string; email?: string; city?: string; message?: string }) =>
    request<{ id: string }>('/leads', { method: 'POST', body: JSON.stringify(body) }),
  // Public doctor/clinic directory (medqr.in/doctors) — only clinics/doctors that opted in ever show up here.
  directorySearch: (opts: { q?: string; specialty?: string; city?: string } = {}) =>
    request<DirectoryDoctorSummary[]>(`/directory/doctors${toQuery(opts)}`),
  directoryDoctor: (slug: string) => request<DirectoryDoctorProfile>(`/directory/doctors/${encodeURIComponent(slug)}`),
  directoryClinic: (slug: string) => request<DirectoryClinicProfile>(`/directory/clinics/${encodeURIComponent(slug)}`),
  directorySpecialties: () => request<string[]>('/directory/specialties'),
  directoryCities: () => request<string[]>('/directory/cities'),
  directorySitemap: () => request<{ doctors: { slug: string; updated_at: string }[]; clinics: { slug: string }[] }>('/directory/sitemap'),
  billingPlan: () => request<MonthlyPlan>('/billing/plan'),
  // Platform-fee trial / subscription (Decision 18)
  getSubscription: () => request<SubscriptionStatus>('/billing/subscription'),
  setupAutopay: () => request<{ subscription_id: string; key_id?: string }>('/billing/subscription/autopay', { method: 'POST' }),

  // ---- Clinic admin / hospital owner (Decision 14) ----
  manage: {
    overview: () => request<ManageOverview>('/manage/overview'),
    activity: (date: string, doctorId?: string) =>
      request<{ date: string; items: ActivityItem[] }>(`/manage/activity?date=${date}${doctorId ? `&doctorId=${encodeURIComponent(doctorId)}` : ''}`),
    doctors: () => request<ManagedDoctor[]>('/manage/doctors'),
    createDoctor: (body: ManagedDoctorBody) => request<ManagedDoctor>('/manage/doctors', { method: 'POST', body: JSON.stringify(body) }),
    updateDoctor: (id: string, body: ManagedDoctorBody) => request<ManagedDoctor>(`/manage/doctors/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteDoctor: (id: string) => request(`/manage/doctors/${id}`, { method: 'DELETE' }),
    users: () => request<ManagedLogin[]>('/manage/users'),
    createUser: (body: { role: 'reception' | 'doctor'; name: string; username: string; mobile_number: string; doctor_id: string | null }) =>
      request<ManagedLogin & StaffLinkResult>('/manage/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUser: (id: string, body: { name?: string; is_active?: boolean; password?: string; mobile_number?: string | null }) =>
      request<ManagedLogin>(`/manage/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    resetPassword: (id: string) =>
      request<StaffLinkResult>(`/manage/users/${id}/reset-password`, { method: 'POST' }),
    setupLink: (id: string) => request<StaffLinkResult>(`/manage/users/${id}/setup-link`, { method: 'POST' }),
    deleteUser: (id: string) => request(`/manage/users/${id}`, { method: 'DELETE' }),
    qrCodes: () => request<QrCodeView[]>('/manage/qr-codes'),
    /** Always for a chosen doctor of this clinic, or the whole clinic (doctor selection on scan). */
    createQrCode: (target: { doctor_id: string } | { whole_clinic: true }) =>
      request<QrCodeView[]>('/manage/qr-codes', { method: 'POST', body: JSON.stringify({ ...target, count: 1 }) }),
    myModuleRequests: () => request<ModuleRequest[]>('/manage/module-requests'),
    requestModule: (module_key: string) => request<ModuleRequest>('/manage/module-requests', { method: 'POST', body: JSON.stringify({ module_key }) }),
  },
};

export interface LoginHints {
  username: string;
  clinic_code: string;
  clinic_name: string;
}
export type SetupInfo =
  | ({ valid: true; name: string; role: StaffRole; expires_at: string } & LoginHints)
  | ({ valid: false; reason: 'used' } & LoginHints)
  | { valid: false; reason: 'expired' };

/** Decision 15: a set-password link for the admin to share (and whether WhatsApp sent it too). */
export interface StaffLinkResult {
  setup_link: string;
  sent: boolean;
  /** 'not_configured' = no approved WhatsApp template yet, so nothing was sent — share it yourself. */
  whatsapp: 'sent' | 'not_configured' | 'no_mobile' | 'failed';
  error?: string;
  username: string;
  clinic_code: string;
  clinic_name: string;
}

export interface ManagedDoctor {
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
}
export type ManagedDoctorBody = Partial<Pick<ManagedDoctor, 'name' | 'qualification' | 'specialty' | 'cabin_label'>>;
export interface ManagedLogin {
  id: string;
  tenant_id: string;
  role: StaffRole;
  name: string;
  username: string;
  doctor_id: string | null;
  mobile_number: string | null; // Decision 15: where a password reset is sent, via WhatsApp
  must_change_password: boolean;
  is_owner: boolean;
  is_active: boolean;
  last_login_at: string | null;
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
