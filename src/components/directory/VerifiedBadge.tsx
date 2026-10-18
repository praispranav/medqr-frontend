import { Icon } from '@/components/patient/ui';

/** Decision 68 — ClinicQ checked this clinic's documents. Shown on cards and clinic/doctor pages. */
export function VerifiedBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      title="ClinicQ checked this clinic's registration documents"
      className={`inline-flex items-center gap-1 rounded-full bg-[#E6F4EA] text-[#137333] font-semibold shrink-0 ${size === 'md' ? 'px-2.5 py-1 text-[13px]' : 'px-2 py-0.5 text-[12px]'}`}
    >
      <Icon name="verified" fill className={size === 'md' ? 'text-[16px]' : 'text-[14px]'} /> Verified
    </span>
  );
}
