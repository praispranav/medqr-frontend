'use client';

import { StaffShell } from '@/components/staff/StaffShell';
import { ProductsHub } from '@/components/products/ProductsHub';

export default function ManageProductsPage() {
  return (
    <StaffShell variant="manage" active="/manage/products">
      {({ tenant, me }) => (
        <ProductsHub tenant={tenant} canManage={me.user.can_manage_clinic} baseRole="manage" />
      )}
    </StaffShell>
  );
}
