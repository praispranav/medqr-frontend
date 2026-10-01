'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { Billing } from '@/components/clinic/Billing';

// Clinic admin — plan (₹499/month per doctor after the first, Decision 14), add-ons and wallet.
export default function ManageBillingPage() {
  return <StaffShell variant="manage" active="/manage/billing">{({ tenant }) => <Billing tenant={tenant} />}</StaffShell>;
}
