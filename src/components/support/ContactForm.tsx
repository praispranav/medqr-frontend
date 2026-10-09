'use client';

import { useState } from 'react';
import { api, ApiError, SUPPORT_TOPIC_LABEL, type SupportTopic } from '@/lib/api';

// Public "Contact us" form (Decision 37). `website` is a honeypot — hidden from people, filled by bots.

const TOPICS = Object.keys(SUPPORT_TOPIC_LABEL) as SupportTopic[];

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [topic, setTopic] = useState<SupportTopic>('question');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.support.contact({ name, email: email || undefined, mobile: mobile || undefined, topic, message, website });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your message. Please try again, or call or email us.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="bg-tertiary-fixed/30 rounded-2xl p-6 flex flex-col gap-2">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Thank you, we got your message.</h3>
        <p className="font-body-md text-body-md text-on-surface-variant">We will reply on the email or mobile number you gave.</p>
      </div>
    );
  }

  const input = 'h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30';
  return (
    <form onSubmit={submit} className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Your name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="name" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">About</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value as SupportTopic)} className={input}>
            {TOPICS.map((t) => (
              <option key={t} value={t}>{SUPPORT_TOPIC_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Mobile number</span>
          <input type="tel" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d+]/g, ''))} className={input} autoComplete="tel" placeholder="98765 43210" />
        </label>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant -mt-2">Give at least one of email or mobile so we can reply.</p>
      <label className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">How can we help? *</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={3000} className="rounded-xl bg-surface-container-low px-3 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" required />
      </label>
      {/* honeypot: real people never see or fill this */}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] w-px h-px opacity-0" />
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      <button disabled={busy || !name.trim() || message.trim().length < 10 || (!email.trim() && !mobile.trim())} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40">
        {busy ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
