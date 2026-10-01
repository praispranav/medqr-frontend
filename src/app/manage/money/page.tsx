'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { PaymentsReport } from '@/components/payments/PaymentsReport';

// Clinic admin — every doctor's money for a day, per-doctor totals, cash handover, CSV (Decision 14).
export default function ManageMoneyPage() {
  return (
    <StaffShell variant="manage" active="/manage/money">
      {({ tenant, doctors }) => (
        <PaymentsReport tenant={tenant} doctorIds={doctors.map((d) => d.id)} doctors={doctors.map((d) => ({ id: d.id, name: d.name }))} scope="owner" />
      )}
    </StaffShell>
  );
}
