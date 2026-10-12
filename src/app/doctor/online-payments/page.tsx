'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { OnlinePaymentSetup } from '@/components/payments/OnlinePaymentSetup';

// Decision 45 — the doctor connects their own Razorpay account so patients pay them directly.
export default function DoctorOnlinePaymentsPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/online-payments">
      {() => <OnlinePaymentSetup />}
    </StaffShell>
  );
}
