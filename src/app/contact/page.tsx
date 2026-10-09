import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLayout } from '@/components/legal/LegalLayout';
import { ContactForm } from '@/components/support/ContactForm';
import { HelpCenter } from '@/components/support/HelpCenter';
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL, CONTACT_WHATSAPP } from '@/components/support/contactInfo';

export const metadata: Metadata = {
  title: 'Contact us and help — MedQR',
  description: 'Contact MedQR, ask for a free trial, and find how-to guides and answers to common questions.',
};

const card = 'bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-1 hover:bg-surface-container-low';

export default function ContactPage() {
  return (
    <LegalLayout wide title="Contact us" lede="Questions, a free trial, or something not working? Write to us, call us, or find the answer below.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 !text-on-surface">
        <a className={card} href={`mailto:${CONTACT_EMAIL}`}>
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Email</span>
          <span className="font-label-lg text-label-lg text-primary break-all">{CONTACT_EMAIL}</span>
        </a>
        <a className={card} href={`tel:${CONTACT_PHONE_TEL}`}>
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Call</span>
          <span className="font-label-lg text-label-lg text-primary">{CONTACT_PHONE_DISPLAY}</span>
        </a>
        <a className={card} href={CONTACT_WHATSAPP} target="_blank" rel="noreferrer">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">WhatsApp</span>
          <span className="font-label-lg text-label-lg text-primary">Message us</span>
        </a>
      </div>

      <section className="flex flex-col gap-4">
        <h2>Send us a message</h2>
        <ContactForm />
        <p className="font-body-sm text-body-sm">
          Already using MedQR? Log in and open <strong>Help &amp; support</strong> in the menu to raise a request with your clinic details attached.{' '}
          <Link className="text-primary underline" href="/login">Doctor/Staff login</Link>
        </p>
      </section>

      <HelpCenter />
    </LegalLayout>
  );
}
