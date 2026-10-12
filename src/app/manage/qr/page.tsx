'use client';

import { api } from '@/lib/api';
import { StaffShell } from '@/components/staff/StaffShell';
import { QrStandees } from '@/components/qr/QrStandees';
import { ArrivalQrCard } from '@/components/qr/ArrivalQrCard';

// Clinic admin — QR standees for the whole clinic (default; scan opens doctor selection) or,
// optionally, one doctor (scan goes straight to that doctor's check-in, no doctor selection). Both are MQ codes, so they count scans and never need reprinting.

export default function ManageQrPage() {
  return (
    <StaffShell variant="manage" active="/manage/qr">
      {({ doctors, tenant }) => (
        <div className="max-w-6xl flex flex-col gap-6">
          <QrStandees doctors={doctors} />
          <ArrivalQrCard load={() => api.arrivalQr(tenant.id)} regenerate={() => api.regenerateArrivalQr(tenant.id)} rulesHint="Queue Rules" />
        </div>
      )}
    </StaffShell>
  );
}
