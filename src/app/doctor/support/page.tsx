'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { StaffSupport } from '@/components/support/StaffSupport';

// Decision 37 — doctors raise requests here and read the help.
export default function DoctorSupportPage() {
  return <StaffShell variant="doctor" active="/doctor/support">{() => <StaffSupport />}</StaffShell>;
}
