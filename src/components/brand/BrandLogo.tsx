import Link from 'next/link';
import { Icon } from '@/components/patient/ui';

/**
 * The one ClinicQ logo (same as the home page header): teal rounded tile with the QR mark + the ClinicQ wordmark.
 * Use this everywhere a public page needs a logo, so it never differs between screens.
 */
export function BrandLogo({ href = '/', tone = 'default', className = '' }: { href?: string; tone?: 'default' | 'light'; className?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2 ${className}`} aria-label="ClinicQ home">
      <span className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shrink-0">
        <Icon name="qr_code_2" className="text-[22px]" />
      </span>
      <span className={`font-headline-sm text-headline-sm ${tone === 'light' ? 'text-white' : 'text-primary'}`}>ClinicQ</span>
    </Link>
  );
}
