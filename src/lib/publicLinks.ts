export const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourclinic' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourclinic' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourclinic' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourclinic' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/yourclinic' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/919876543210' },
] as const;

/** Guard old/imported data as well as links validated by the API. */
export function publicWebLink(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text.replace(/^\/\//, '')}`);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}
