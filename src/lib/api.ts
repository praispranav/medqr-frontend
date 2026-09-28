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
export type AdvanceMode = 'manual' | 'auto_timer' | 'reception';
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
}

/** Decision 6 — today-only, four states. */
export type DoctorTodayStatus = 'available' | 'on_break' | 'starts_later_today' | 'off_today';

export interface DoctorToday {
  id: string;
  name: string;
  qualification: string | null;
  specialty: string | null;
  cabin_label: string | null;
  photo_url: string | null;
  today_status: DoctorTodayStatus;
  today_status_detail: string;
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

export type TokenStatus = 'booked' | 'waiting_in_clinic' | 'checked_in_early' | 'in_consultation' | 'done' | 'no_show';

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
  visit: Pick<Visit, 'id' | 'chief_complaint' | 'vitals' | 'is_paid' | 'consultation_fee_inr' | 'payment_method' | 'payment_choice'> | null;
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

export type StaffRole = 'reception' | 'doctor';

export interface Me {
  user: { id: string; name: string; username: string; role: StaffRole; doctor_id: string | null };
  tenant: { id: string; subdomain: string; display_name: string | null };
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
  doctor?: { id: string; name: string; specialty: string | null; cabin_label: string | null; today_status: DoctorTodayStatus; today_status_detail: string };
}

export const api = {
  // Standalone QR standees (/q/<code>) — created unassigned, linked by admin or by the doctor scanning it
  resolveQr: (code: string) => request<QrResolve>(`/qr/${encodeURIComponent(code)}`),
  claimQr: (code: string) => request<QrCodeView>('/qr-codes/claim', { method: 'POST', body: JSON.stringify({ code }) }),
  myQrCodes: () => request<QrCodeView[]>('/qr-codes/mine'),

  // Staff login (reception and doctors have separate accounts)
  login: (body: { clinic: string; username: string; password: string }) =>
    request<Me>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<Me>('/auth/me'),
  getMyTenant: () => request<Tenant>('/tenants/mine'),
  addPatientAttachment: (tokenId: string, file: { url: string; name: string }) =>
    request(`/queue/tokens/${tokenId}/attachments`, { method: 'POST', body: JSON.stringify(file) }),

  getTenantBySubdomain: (subdomain: string) => request<Tenant | null>(`/tenants/by-subdomain/${subdomain}`),
  getDoctorsToday: (tenantId: string) => request<DoctorToday[]>(`/doctors/tenant/${tenantId}/today`),
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
  }) => request<{ id: string; token_number: number; visit_id: string | null }>('/queue/join', { method: 'POST', body: JSON.stringify(body) }),
  getToken: (tokenId: string) => request<TokenStatusView>(`/queue/tokens/${tokenId}`),
  checkIn: (tokenId: string) => request(`/queue/tokens/${tokenId}/check-in`, { method: 'POST' }),
  callNext: (doctorId: string) => request<{ id: string } | null>(`/queue/doctors/${doctorId}/call-next`, { method: 'POST' }),
  callToken: (tokenId: string) => request(`/queue/tokens/${tokenId}/call`, { method: 'POST' }),
  markNoShow: (tokenId: string) => request(`/queue/tokens/${tokenId}/no-show`, { method: 'POST' }),
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
  paymentReport: (date: string) => request<PaymentReport>(`/payments/report?date=${date}`),
  simulateQrPayment: (qrId: string) => request(`/payments/dev/qr/${qrId}/simulate-paid`, { method: 'POST' }),
  updateQueueSettings: (tenantId: string, patch: Partial<QueueSettings>) =>
    request<Tenant>(`/tenants/${tenantId}/queue-settings`, { method: 'PATCH', body: JSON.stringify(patch) }),
  // Doctor portal "My Hours"
  listSessions: (doctorId: string, date: string) => request<DoctorSession[]>(`/doctors/${doctorId}/sessions?date=${date}`),
  addSession: (doctorId: string, body: { session_date: string; starts_at: string; ends_at: string; is_break: boolean }) =>
    request<DoctorSession>(`/doctors/${doctorId}/sessions`, { method: 'POST', body: JSON.stringify(body) }),
  repeatSessions: (doctorId: string, from_date: string, days: number) =>
    request<{ copied_to: string[] }>(`/doctors/${doctorId}/sessions/repeat`, { method: 'POST', body: JSON.stringify({ from_date, days }) }),
  setSessionActive: (doctorId: string, sessionId: string, is_active: boolean) =>
    request<DoctorSession>(`/doctors/${doctorId}/sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
  deleteSession: (doctorId: string, sessionId: string) =>
    request(`/doctors/${doctorId}/sessions/${sessionId}`, { method: 'DELETE' }),
  startBreak: (doctorId: string, minutes: number) =>
    request<DoctorSession>(`/doctors/${doctorId}/break`, { method: 'POST', body: JSON.stringify({ minutes }) }),
  endBreak: (doctorId: string) => request(`/doctors/${doctorId}/break/end`, { method: 'POST' }),
  stopForToday: (doctorId: string) => request(`/doctors/${doctorId}/stop-today`, { method: 'POST' }),
  uploadFile,
  getBillingCatalog: () => request<{ base_plan_price_inr: number; add_ons: CatalogAddOn[] }>('/billing/catalog'),
};
