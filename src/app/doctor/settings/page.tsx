'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { QueueRules } from '@/components/clinic/QueueRules';

// Screen #9 — Queue Rules (component in components/clinic/QueueRules.tsx). Clinic-wide, so in a
// multi-doctor clinic only the clinic admin opens it (Decision 14).
export default function DoctorSettingsPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/settings" managersOnly>
      {({ tenant, refreshTenant }) => <QueueRules key={tenant.id} tenant={tenant} onSaved={refreshTenant} />}
    </StaffShell>
  );
}
