'use client';

import { useState } from 'react';
import type { StaffLinkResult } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// Decision 15: after creating a login or resetting a password, the admin shares the set-password
// link themselves — from their own WhatsApp (click-to-chat, free, no template approval needed) or
// by copying it. The automatic WhatsApp template message is a bonus when one is approved.

export interface ShareTarget extends StaffLinkResult {
  name: string;
  mobile: string | null;
  kind: 'invite' | 'reset';
}

function messageFor(t: ShareTarget) {
  const site = new URL(t.setup_link).origin;
  const intro =
    t.kind === 'invite'
      ? `Hello ${t.name}, your MedQR login for ${t.clinic_name} is ready.`
      : `Hello ${t.name}, your MedQR password for ${t.clinic_name} has been reset.`;
  return [
    intro,
    '',
    `1. Set your password here (link valid for 24 hours):`,
    t.setup_link,
    '',
    `2. Then log in at ${site}/login`,
    `Clinic code: ${t.clinic_code}`,
    `Username: ${t.username}`,
  ].join('\n');
}

/** wa.me click-to-chat: opens the admin's own WhatsApp on this person's number with the message typed in. */
export function whatsappHref(target: ShareTarget) {
  const digits = (target.mobile ?? '').replace(/\D/g, '');
  const waNumber = digits.length === 10 ? `91${digits}` : digits; // wa.me needs the country code, no "+"
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(messageFor(target))}`;
}

export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.662-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function ShareLinkCard({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const [copied, setCopied] = useState<'message' | 'link' | null>(null);
  const message = messageFor(target);
  const waHref = whatsappHref(target);

  const copy = async (what: 'message' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'message' ? message : target.setup_link);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked — the message box below is selectable */
    }
  };

  const status =
    target.whatsapp === 'sent'
      ? `We also sent it to ${target.name}’s WhatsApp.`
      : target.whatsapp === 'failed'
        ? `Our automatic WhatsApp message didn’t go through${target.error ? ` (${target.error})` : ''} — please share it yourself.`
        : null;

  return (
    <section className="bg-primary-fixed/20 ring-2 ring-primary/30 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            {target.kind === 'invite' ? `Share the login link with ${target.name}` : `Send ${target.name} their new password link`}
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            They open it, set their own password, then log in. The link works once, for 24 hours.
            {target.kind === 'reset' ? ' Their old password has stopped working.' : ''}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
          <Icon name="close" className="text-[20px]" />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 px-4 rounded-xl bg-[#25D366] text-white font-label-lg text-label-lg flex items-center gap-2 hover:opacity-90"
        >
          <WhatsAppIcon /> Share on WhatsApp{target.mobile ? ` (${target.mobile})` : ''}
        </a>
        <button onClick={() => copy('message')} className="h-11 px-4 rounded-xl bg-surface-container-lowest text-primary font-label-lg text-label-lg flex items-center gap-2 shadow-sm">
          <Icon name={copied === 'message' ? 'check' : 'content_copy'} className="text-[18px]" />
          {copied === 'message' ? 'Copied' : 'Copy message'}
        </button>
        <button onClick={() => copy('link')} className="h-11 px-4 rounded-xl bg-surface-container-lowest text-on-surface-variant font-label-md text-label-md flex items-center gap-2 shadow-sm">
          <Icon name={copied === 'link' ? 'check' : 'link'} className="text-[18px]" />
          {copied === 'link' ? 'Copied' : 'Copy link only'}
        </button>
      </div>

      <pre className="bg-surface-container-lowest rounded-xl p-3 font-body-sm text-body-sm text-on-surface whitespace-pre-wrap break-all select-all">{message}</pre>
      {status && <p className={`font-body-sm text-body-sm ${target.whatsapp === 'sent' ? 'text-tertiary' : 'text-secondary'}`}>{status}</p>}
    </section>
  );
}
