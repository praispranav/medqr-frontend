'use client';
import type { ReferrerRates } from '@/lib/adminApi';

export function MarketingTerms({ value, onChange }: { value: ReferrerRates; onChange: (v: ReferrerRates) => void }) {
  const basis = value.compensation_basis ?? 'per_clinic';
  return <div className="grid sm:grid-cols-2 gap-3">
    <label className="flex flex-col gap-1"><span>Payment basis</span>
      <select aria-label="Payment basis" className="h-12 rounded-xl bg-surface-container-low px-3" value={basis} onChange={(e) => onChange({ ...value, compensation_basis: e.target.value as 'per_clinic' | 'salary' })}>
        <option value="per_clinic">Per approved clinic</option><option value="salary">Monthly salary</option>
      </select>
    </label>
    <label className="flex flex-col gap-1"><span>{basis === 'salary' ? 'Monthly salary (₹)' : 'Amount per approved clinic (₹)'}</span>
      <input aria-label={basis === 'salary' ? 'Monthly salary' : 'Amount per approved clinic'} type="number" min="0" step="1" className="h-12 rounded-xl bg-surface-container-low px-3" value={(basis === 'salary' ? value.salary_inr : value.per_clinic_inr) ?? 0} onChange={(e) => onChange({ ...value, [basis === 'salary' ? 'salary_inr' : 'per_clinic_inr']: Number(e.target.value) })} />
    </label>
    <p className="sm:col-span-2 text-body-sm text-on-surface-variant">Per-clinic earnings require super-admin approval of a new clinic. Duplicate uploads earn nothing. Salary accrues once per calendar month while the login is active. Payments are made outside ClinicQ and recorded here.</p>
  </div>;
}
