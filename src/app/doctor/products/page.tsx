'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { ProductsHub } from '@/components/products/ProductsHub';

export default function DoctorProductsPage() {
  return (
    <StaffShell variant="doctor" active="/doctor/products">
      {({ tenant, me }) => (
        <ProductsHub tenant={tenant} canManage={me.user.can_manage_clinic} baseRole="doctor" />
      )}
    </StaffShell>
  );
}
