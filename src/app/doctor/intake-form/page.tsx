'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { IntakeFormEditor } from '@/components/doctor/IntakeFormEditor';

// Settings → Intake Form: this doctor's extra intake questions (moved out of Public Profile).
export default function DoctorIntakeFormPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/intake-form">
      {({ doctor, refreshTenant }) => (doctor ? <IntakeFormEditor key={doctor.id} doctor={doctor} onSaved={refreshTenant} /> : null)}
    </StaffShell>
  );
}
