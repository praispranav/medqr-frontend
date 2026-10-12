'use client';

import { useState } from 'react';
import { Icon } from '@/components/patient/ui';

// Decision 45 — why no GST is charged on the consultation fee, with the legal references to check.
// Information only; not tax advice.

export function GstNote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setOpen((o) => !o)} className="self-start flex items-center gap-1.5 font-label-md text-label-md text-primary" aria-expanded={open}>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[20px]" /> GST and your consultation fee
      </button>

      {open && (
        <div className="flex flex-col gap-3 font-body-md text-body-md text-on-surface-variant">
          <p>
            <strong className="text-on-surface">How the money moves.</strong> The patient pays by UPI into <em>your own</em> Razorpay account, and Razorpay
            settles it to your bank account on its normal schedule. ClinicQ never holds the money and does not deduct anything from the fee. Any Razorpay
            charges follow your own Razorpay account&apos;s pricing.
          </p>
          <p>
            <strong className="text-on-surface">No GST on the fee.</strong> Health care services by a clinical establishment or an authorised medical
            practitioner are exempt from GST. Razorpay and ClinicQ do not collect or file GST on your consultation fee.
          </p>
          <div>
            <p className="font-label-md text-label-md text-on-surface mb-1">Where this comes from</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>
                <strong>Exemption:</strong> Notification No. 12/2017–Central Tax (Rate), dated 28 June 2017, Sl. No. 74 (heading 9993) — health care services
                by a clinical establishment, an authorised medical practitioner or para-medics. The same entry is in the IGST notification (No. 9/2017–Integrated
                Tax (Rate)) and each state&apos;s notification.
              </li>
              <li>
                <strong>Registration:</strong> Section 23(1)(a) of the CGST Act, 2017 — a person who supplies only exempt services does not need to register
                for GST, so there is nothing to file for consultation income.
              </li>
              <li>
                <strong>If you are GST-registered</strong> (for example for other taxable supplies): show consultation income as an exempt supply — GSTR-1
                Table 8 and GSTR-3B Table 3.1(c). Input tax credit is not available on exempt supplies (Section 17(2)).
              </li>
            </ul>
          </div>
          <p>
            You do not &quot;claim&quot; GST on this fee — the exemption applies by itself. Cosmetic or aesthetic procedures and separate sale of products can be
            taxable. The fees are your professional income, so include them in your income-tax return; the Payments log (with CSV download) is your record.
          </p>
          <p className="text-[13px]">
            Check the notifications yourself at{' '}
            <a href="https://cbic-gst.gov.in" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
              cbic-gst.gov.in
            </a>{' '}
            (Notifications → Central Tax (Rate)). This is general information, not tax advice — please confirm with your chartered accountant.
          </p>
        </div>
      )}
    </div>
  );
}
