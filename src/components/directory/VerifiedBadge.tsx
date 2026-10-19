import { Icon } from '@/components/patient/ui';

/** Only shown when ClinicQ has checked the clinic's registration documents. */
export function VerifiedBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return <span role="img" aria-label="Verified by ClinicQ" title="ClinicQ checked this clinic's registration documents" className="inline-flex items-center text-tertiary shrink-0 align-middle">
    <Icon name="verified" fill className={size === 'md' ? 'text-[18px]' : 'text-[16px]'} />
  </span>;
}
