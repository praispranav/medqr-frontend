import { EditorialLanding } from './EditorialLanding';
import { PlayfulLanding } from './PlayfulLanding';
import { ClassicLanding } from './ClassicLanding';
import { BoldLanding } from './BoldLanding';
import { jsonLd, type LandingProps } from './landingData';

/** Decision 50 — the clinic's public landing page, in the look the clinic chose. */
export function ClinicLanding(props: LandingProps) {
  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(props.clinic)).replace(/</g, '\\u003c') }} />
      {props.clinic.landing_template === 'playful' ? <PlayfulLanding {...props} /> : props.clinic.landing_template === 'classic' ? <ClassicLanding {...props} /> : props.clinic.landing_template === 'bold' ? <BoldLanding {...props} /> : <EditorialLanding {...props} />}
    </>
  );
}
