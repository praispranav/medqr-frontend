'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { OnlinePaymentSetup } from '@/components/payments/OnlinePaymentSetup';

// Decision 45 — the clinic admin connects the clinic's own Razorpay account (one for the whole clinic).
export default function ManageOnlinePaymentsPage() {
  return (
    <StaffShell variant="manage" active="/manage/online-payments">
      {() => <OnlinePaymentSetup />}
    </StaffShell>
  );
}
