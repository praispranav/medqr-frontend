'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { ClinicDetails } from '@/components/clinic/ClinicDetails';

// Clinic admin — the clinic's address, phone and public listing (moved out of Queue Rules).
export default function ManageClinicPage() {
  return (
    <StaffShell variant="manage" active="/manage/clinic">
      {({ tenant, refreshTenant }) => (
        <div className="max-w-3xl flex flex-col gap-6">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Clinic Profile</h1>
          <ClinicDetails key={tenant.id} tenant={tenant} onSaved={refreshTenant} canEdit />
        </div>
      )}
    </StaffShell>
  );
}
