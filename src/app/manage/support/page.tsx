'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { StaffSupport } from '@/components/support/StaffSupport';

export default function ManageSupportPage() {
  return <StaffShell variant="manage" active="/manage/support">{() => <StaffSupport />}</StaffShell>;
}
