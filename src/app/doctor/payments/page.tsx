'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { PaymentsReport } from '@/components/payments/PaymentsReport';

// Doctor's payment log — own patients only (enforced server-side).
export default function DoctorPaymentsPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/payments">
      {({ tenant, doctor }) => <PaymentsReport tenant={tenant} doctorIds={[doctor!.id]} scope="doctor" />}
    </StaffShell>
  );
}
