'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { PaymentsReport } from '@/components/payments/PaymentsReport';

// Reception's payment log — whole clinic.
export default function ReceptionPaymentsPage() {
  return (
    <StaffShell variant="reception" active="/reception/payments">
      {({ tenant, doctors }) => <PaymentsReport tenant={tenant} doctorIds={doctors.map((d) => d.id)} scope="clinic" />}
    </StaffShell>
  );
}
