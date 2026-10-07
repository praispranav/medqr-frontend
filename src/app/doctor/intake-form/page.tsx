'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { IntakeFormEditor } from '@/components/doctor/IntakeFormEditor';

// Settings → Intake Form: this doctor's extra intake questions (moved out of Public Profile).
export default function DoctorIntakeFormPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/intake-form">
      {({ doctor, tenant, refreshTenant }) =>
        doctor ? <IntakeFormEditor key={doctor.id} doctor={doctor} clinicLanguage={tenant.queue_settings.patient_language} onSaved={refreshTenant} /> : null
      }
    </StaffShell>
  );
}
