import { Icon } from '@/components/patient/ui';

/** Compact result marker; the matching filter keeps its visible label. */
export function OnlineTokenBadge() {
  return <span role="img" aria-label="Online token available" title="Online token available" className="inline-flex shrink-0 items-center text-primary align-middle">
    <Icon name="confirmation_number" className="text-[16px]" />
  </span>;
}
