'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { PatientNotifications } from '@/components/doctor/PatientNotifications';

// Settings → Patient Notifications: this doctor's automatic WhatsApp updates (moved out of Public Profile).
export default function DoctorNotificationsPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/notifications">
      {({ doctor, tenant, refreshTenant }) => (doctor ? <PatientNotifications key={doctor.id} doctor={doctor} tenant={tenant} onSaved={refreshTenant} /> : null)}
    </StaffShell>
  );
}
