import { SOCIAL_PLATFORMS, publicWebLink } from '@/lib/publicLinks';
import type { DirectoryClinicProfile, DirectoryLandingDoctor } from '@/lib/api';
import { clinicAddress, directionsUrl, telHref } from './landingData';

/** The address belongs to the clinic and has one home, below the doctor profiles. */
export function ClinicVisitDetails({ clinic, doctors, className = '' }: {
  clinic: DirectoryClinicProfile;
  doctors: DirectoryLandingDoctor[];
  className?: string;
}) {
  const website = publicWebLink(clinic.website_url);
  const links = [
    ...(website ? [{ label: 'Website', url: website }] : []),
    ...Object.entries(clinic.social_links ?? {}).flatMap(([key, value]) => {
      const url = publicWebLink(value);
      return url ? [{ label: SOCIAL_PLATFORMS.find(p => p.key === key)?.label ?? (key === 'twitter' ? 'X (Twitter)' : key), url }] : [];
    }),
  ];
  const address = clinicAddress(clinic);
  const maps = directionsUrl(clinic);
  const phone = telHref(clinic.public_phone);
  const consultingHours = doctors.filter(d => d.hours?.trim());
  const hasHours = clinic.is_open_24x7 || clinic.operating_hours?.trim() || consultingHours.length > 0;
  if (!address && !maps && !phone && !hasHours && !links.length) return null;

  return (
    <section aria-label="Visit the clinic" className={`rounded-2xl p-5 sm:p-7 ${className}`}>
      <h2 className="font-headline-sm text-headline-sm mb-5">Visit the clinic</h2>
      <div className={`grid gap-6 ${hasHours ? 'md:grid-cols-2 md:gap-10' : ''}`}>
        <div className="min-w-0 flex flex-col items-start gap-2">
          {clinic.clinic_name && <p className="font-label-lg text-label-lg">{clinic.clinic_name}</p>}
          {address && <address className="not-italic text-body-md leading-relaxed break-words max-w-xl">{address}</address>}
          <div className="mt-2 flex flex-wrap gap-2">
            {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-label-md font-label-md text-on-primary transition-colors hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span aria-hidden="true" className="material-symbols-outlined text-[18px]">near_me</span>Get directions</a>}
            {phone && <a href={phone} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary/5 px-4 text-label-md font-label-md text-primary transition-colors hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span aria-hidden="true" className="material-symbols-outlined text-[18px]">call</span>Call clinic</a>}
          </div>
          {phone && <a href={phone} className="inline-flex min-h-11 items-center text-body-sm text-primary underline underline-offset-4">{clinic.public_phone}</a>}
        </div>
        {hasHours && <div className="min-w-0 flex flex-col gap-3">
          <h3 className="font-label-lg text-label-lg">Hours</h3>
          {(clinic.is_open_24x7 || clinic.operating_hours?.trim()) && <div>
            <p className="font-label-md text-label-md">Clinic hours</p>
            <p className="text-body-md leading-relaxed whitespace-pre-line">{clinic.is_open_24x7 ? 'Open 24 hours, every day' : clinic.operating_hours}</p>
          </div>}
          {consultingHours.map(d => <div key={d.id}>
            <p className="font-label-md text-label-md">{d.name}</p>
            <p className="text-body-md leading-relaxed whitespace-pre-line">{d.hours}</p>
          </div>)}
        </div>}
      </div>
      {links.length > 0 && <nav aria-label="Clinic website and social links" className="mt-5 flex flex-col gap-1">
        <h3 className="font-label-md text-label-md">Website &amp; social links</h3>
        <div className="flex flex-wrap gap-x-5 gap-y-1">{links.map(({ label, url }) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-label-md text-primary underline underline-offset-4">{label}<span aria-hidden="true" className="material-symbols-outlined text-[14px]">open_in_new</span></a>)}</div>
      </nav>}
    </section>
  );
}
