'use client';
import { useEffect, useState } from 'react';
import { api, type DirectoryProduct } from '@/lib/api';
export const DEFAULT_DIRECTORY_PRODUCT = 'qr-token-system';
export function DirectoryProductFilter({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [products, setProducts] = useState<DirectoryProduct[]>([{ key: DEFAULT_DIRECTORY_PRODUCT, name: 'QR Token System' }]);
  useEffect(() => { api.directoryProducts().then(setProducts).catch(() => undefined); }, []);
  return <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">Product
    <select aria-label="Product" value={value} onChange={(e) => onChange(e.target.value)} className="h-12 rounded-xl bg-surface-container-low px-3 text-body-md text-on-surface">
      {products.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
      <option value="all">All products</option>
    </select>
  </label>;
}
