'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { StaffSupport } from '@/components/support/StaffSupport';

export default function ReceptionSupportPage() {
  return <StaffShell variant="reception" active="/reception/support">{() => <StaffSupport />}</StaffShell>;
}
