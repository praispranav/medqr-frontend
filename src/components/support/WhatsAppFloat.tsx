import { CONTACT_PHONE_DISPLAY, CONTACT_WHATSAPP } from './contactInfo';

/**
 * Floating "Chat on WhatsApp" button for public marketing pages (bottom-right, above page content but
 * under dialogs, which use z-50). A round icon on phones; with a label from small screens up.
 */
export function WhatsAppFloat() {
  return (
    <a
      href={CONTACT_WHATSAPP}
      target="_blank"
      rel="noreferrer"
      aria-label={`Chat with us on WhatsApp, ${CONTACT_PHONE_DISPLAY}`}
      title={`WhatsApp ${CONTACT_PHONE_DISPLAY}`}
      className="fixed z-40 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6 h-14 w-14 sm:w-auto sm:pl-4 sm:pr-5 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 flex items-center justify-center gap-2 font-label-lg text-label-lg hover:bg-[#1EBE5B] active:scale-95 transition"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" className="w-7 h-7 shrink-0" fill="currentColor">
        <path d="M16.004 3C8.832 3 3 8.83 3 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.75A12.95 12.95 0 0 0 16.004 29C23.17 29 29 23.17 29 16S23.17 3 16.004 3Zm0 23.62c-2 0-3.96-.54-5.67-1.56l-.4-.24-3.97 1.04 1.06-3.87-.26-.4A10.6 10.6 0 0 1 5.38 16c0-5.86 4.77-10.62 10.63-10.62 5.85 0 10.6 4.76 10.6 10.62 0 5.85-4.76 10.62-10.6 10.62Zm5.82-7.95c-.32-.16-1.89-.93-2.18-1.04-.3-.1-.5-.16-.72.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.69.08-.32-.16-1.34-.5-2.56-1.58-.94-.84-1.58-1.88-1.77-2.2-.18-.32-.02-.49.14-.65.15-.15.32-.37.48-.56.16-.18.21-.32.32-.53.1-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.47 4.84.77.33 1.36.53 1.83.68.77.24 1.47.21 2.02.13.62-.09 1.89-.77 2.16-1.52.27-.74.27-1.38.19-1.52-.08-.13-.29-.21-.61-.37Z" />
      </svg>
      <span className="hidden sm:inline">Chat with us</span>
    </a>
  );
}
