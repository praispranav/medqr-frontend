'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { Billing } from '@/components/clinic/Billing';

// Screen #10 — Billing (component in components/clinic/Billing.tsx). Solo doctor or clinic admin (Decision 14).
export default function BillingPage() {
  return <StaffShell variant="doctor" active="/doctor/billing" managersOnly>{({ tenant }) => <Billing tenant={tenant} />}</StaffShell>;
}
