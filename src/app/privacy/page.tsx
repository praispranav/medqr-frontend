import type { Metadata } from 'next';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from '@/components/support/contactInfo';

export const metadata: Metadata = { title: 'Privacy Policy — MedQR' };

const UPDATED = '9 October 2026';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated={UPDATED}>
      <p className="font-body-lg text-body-lg text-on-surface">
        MedQR is a registered product and software service owned and operated by <strong>Altis Labs</strong>. This
        policy explains what information MedQR collects, why, and how it&apos;s protected — for both the clinics that
        run on MedQR and the patients who use a clinic&apos;s digital queue.
      </p>

      <section>
        <h2>1. What we collect</h2>
        <p><strong>From patients</strong> (entered by the patient, or by reception/the doctor on their behalf):</p>
        <ul>
          <li>Name, mobile number, age and gender</li>
          <li>Reason for visit and, if recorded, vitals such as blood pressure, weight, height, temperature and SpO2 — every field is optional</li>
          <li>Photos of prescriptions or reports the patient chooses to upload, and the doctor&apos;s consultation note</li>
          <li>Queue activity — token number, join/call times, and whether a token was completed or missed</li>
          <li>Payment activity for a visit — amount, method (cash, UPI at counter, or online), and status; MedQR does not store card or UPI credentials itself (see Section 4)</li>
        </ul>
        <p><strong>From clinic staff</strong> (doctors, reception, clinic admins):</p>
        <ul>
          <li>Name, username, mobile number and role, used to run the staff login and send password resets</li>
          <li>Activity within the app — logins, shift start/end, queue and settings changes — kept as a clinic activity log</li>
        </ul>
        <p><strong>Automatically:</strong> basic technical data such as IP address and browser type, and — on the device the patient checks in from — a small signed token kept in local storage so a returning patient doesn&apos;t have to retype their details next visit.</p>
      </section>

      <section>
        <h2>2. Why we collect it</h2>
        <ul>
          <li>To run the queue: issue tokens, show live wait status, and notify patients when it&apos;s their turn</li>
          <li>To keep the visit and consultation record the clinic asked to be kept</li>
          <li>To operate staff logins and enforce that each clinic only sees its own patients and data</li>
          <li>To send WhatsApp updates the clinic or patient opted into (token confirmed, you&apos;re next, your turn, or an OTP where a clinic requires phone verification)</li>
          <li>To process online payments where a clinic offers them, and to keep the payment log every action is written to</li>
          <li>To bill the clinic for its MedQR subscription</li>
        </ul>
        <p>We do not sell patient or clinic data, and we do not use it for advertising.</p>
      </section>

      <section>
        <h2>3. Who your data is visible to</h2>
        <p>
          Patient data for a visit is visible to that clinic&apos;s reception and the treating doctor only — never to
          another clinic, and never to a different doctor at the same clinic unless the clinic has more than one doctor
          and a clinic admin role is explicitly granted oversight (which still excludes clinical notes). A patient&apos;s
          own consultation notes are visible only to the treating doctor and, where recorded, reception&apos;s check-in
          details (vitals, contact info) — not the free-text note itself.
        </p>
      </section>

      <section>
        <h2>4. Third parties we use to run the Service</h2>
        <p>MedQR uses a small number of service providers (&quot;processors&quot;) to operate the platform. They only receive what they need to do their specific job:</p>
        <ul>
          <li><strong>Telnyx</strong> — delivers WhatsApp messages (OTPs and queue notifications) via the WhatsApp Business Platform. A patient&apos;s mobile number and the message content are shared with Telnyx/WhatsApp for delivery.</li>
          <li><strong>Razorpay</strong> — processes online UPI payments a patient chooses to make. Card, UPI or bank details are handled directly by Razorpay; MedQR never receives or stores them, only the payment status and amount.</li>
          <li><strong>Google Firebase</strong> — delivers the optional &quot;Alert me when it&apos;s my turn&quot; push notification to a patient&apos;s browser, only if the patient turns it on. It receives a device notification address and the notification text.</li>
          <li><strong>An AI language-model provider</strong> — used only to understand a doctor&apos;s own WhatsApp reply to a shift reminder (for example &quot;start&quot; or &quot;delay 30 minutes&quot;). Patient information is not sent for this.</li>
          <li>Cloud infrastructure providers that host MedQR&apos;s servers and databases.</li>
        </ul>
        <p>We don&apos;t share data with anyone else without the clinic&apos;s or patient&apos;s knowledge, except where required by law.</p>
      </section>

      <section>
        <h2>5. How long we keep it</h2>
        <p>
          We retain visit and consultation records for as long as the clinic&apos;s account is active and as needed to
          meet applicable medical-record and tax retention requirements, even after an account is closed. Staff login
          activity and payment logs are kept for the clinic&apos;s own audit trail. A patient can ask their clinic to
          delete their profile from MedQR at any time, subject to any retention the clinic itself is legally required to
          keep.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <ul>
          <li>Staff passwords are never stored in plain text (scrypt-hashed) and are never chosen or seen by an administrator — a random one is generated and must be changed on first use.</li>
          <li>Every staff session is scoped to one clinic; the server enforces that a login can only reach its own clinic&apos;s data.</li>
          <li>Traffic to MedQR is encrypted in transit (HTTPS).</li>
          <li>A patient&apos;s phone is only linked to profiles it created itself unless the clinic requires WhatsApp OTP verification for that number.</li>
        </ul>
      </section>

      <section>
        <h2>7. Your choices</h2>
        <ul>
          <li>WhatsApp updates are opt-in and can be turned off at check-in.</li>
          <li>A patient can ask reception, or MedQR directly, to correct or delete their stored information.</li>
          <li>&quot;Remember me on this phone&quot; is optional at check-in — declining it means the device won&apos;t be recognised on a future visit.</li>
          <li>Push notifications are opt-in and can be turned off in the browser settings at any time.</li>
          <li>Messages you send us through the Contact page or Help &amp; support (name, email or mobile number, and what you write) are used only to reply to you and to improve the Service.</li>
        </ul>
      </section>

      <section>
        <h2>8. Grievance officer and contact</h2>
        <p>
          For any question about this policy, or to request access, correction or deletion of your data, write to{' '}
          <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or call or message{' '}
          <a className="text-primary underline" href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a>. You can also use the{' '}
          <a className="text-primary underline" href="/contact">Contact page</a>. We aim to respond within a reasonable time and in any
          case as required by applicable Indian data protection law.
        </p>
        <p className="mt-3 font-body-sm text-body-sm">
          Brand: MedQR · Operated by: Altis Labs · PAN: GRTPK1849H · Udyam Registration No: UDYAM-BR-34-0066884
        </p>
      </section>
    </LegalLayout>
  );
}
