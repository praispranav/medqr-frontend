'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { QueueRules } from '@/components/clinic/QueueRules';

// Clinic admin — clinic-wide Queue Rules (Decision 14: with 2+ doctors only the admin changes these).
export default function ManageSettingsPage() {
  return (
    <StaffShell variant="manage" active="/manage/settings">
      {({ tenant, refreshTenant }) => <QueueRules key={tenant.id} tenant={tenant} onSaved={refreshTenant} />}
    </StaffShell>
  );
}
