import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { COMPANY_NAME, COMPANY_URL, INSTAGRAM_URL } from '@/components/support/contactInfo';

/** Shared close for the public directory and clinic pages. */
export function PublicFooter({ clinicCode }: { clinicCode?: string }) {
  return <footer aria-label="About ClinicQ" className="bg-surface-container-low text-on-surface mt-10">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="max-w-md flex flex-col gap-3">
          <BrandLogo />
          <p className="text-body-md text-on-surface-variant">Find doctors, explore clinics and take an online OPD token at participating clinics.</p>
        </div>
        <nav aria-label="Explore ClinicQ" className="flex flex-wrap gap-2 sm:gap-3">
          {([{ href: '/doctors', label: 'Find doctors' }, { href: '/clinics', label: 'Find clinics' }, { href: '/for-clinics', label: 'For clinics' }]).map(link => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary/30 bg-transparent px-5 text-label-md text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{link.label}</Link>)}
        </nav>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-body-sm text-on-surface-variant">
        <p>© {new Date().getFullYear()} ClinicQ · A product of <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{COMPANY_NAME}</a></p>
        <nav aria-label="ClinicQ information" className="flex flex-wrap gap-x-4">
          {clinicCode && <><Link className="min-h-11 inline-flex items-center" href={`/claim/${clinicCode}`}>Claim this clinic</Link><Link className="min-h-11 inline-flex items-center" href={`/claim/${clinicCode}?kind=remove`}>Remove listing</Link></>}
          <Link href="/terms" className="min-h-11 inline-flex items-center">Terms</Link>
          <Link href="/privacy" className="min-h-11 inline-flex items-center">Privacy</Link>
          <Link href="/contact" className="min-h-11 inline-flex items-center">Contact &amp; help</Link>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center">Instagram</a>
        </nav>
      </div>
    </div>
  </footer>;
}
