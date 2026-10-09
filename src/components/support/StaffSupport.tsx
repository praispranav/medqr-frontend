'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, SUPPORT_TOPIC_LABEL, type SupportRequest, type SupportStatus, type SupportTopic } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { HelpCenter } from './HelpCenter';
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL, CONTACT_WHATSAPP } from './contactInfo';

// In-app Support page (Decision 37) for doctors, reception and clinic admins: raise a request, see
// its status and our reply, and read the help below. Who you are and which clinic is attached for you.

const TOPICS = Object.keys(SUPPORT_TOPIC_LABEL) as SupportTopic[];
const STATUS: Record<SupportStatus, { text: string; className: string }> = {
  new: { text: 'Received', className: 'bg-primary-container text-on-primary-container' },
  in_progress: { text: 'We are on it', className: 'bg-secondary-container text-on-secondary-container' },
  resolved: { text: 'Resolved', className: 'bg-tertiary-container text-white' },
};

export function StaffSupport() {
  const [topic, setTopic] = useState<SupportTopic>('question');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mine, setMine] = useState<SupportRequest[] | null>(null);

  const load = useCallback(() => api.support.mine().then(setMine).catch(() => setMine([])), []);
  useEffect(() => {
    load();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api.support.create({ topic, message });
      setMessage('');
      setDone(true);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your request. Please try again, or call us.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Help &amp; support</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Raise a request and we will reply here. Your name and clinic are added for you. For anything urgent, call or message us:{' '}
          <a className="text-primary underline" href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a> ·{' '}
          <a className="text-primary underline" href={CONTACT_WHATSAPP}>WhatsApp</a> ·{' '}
          <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>

      <form onSubmit={send} className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
          <Icon name="support_agent" className="text-primary text-[24px]" /> Raise a request
        </h2>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">About</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value as SupportTopic)} className="h-12 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md">
            {TOPICS.filter((t) => t !== 'trial').map((t) => (
              <option key={t} value={t}>{SUPPORT_TOPIC_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-on-surface-variant">What do you need?</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={3000} placeholder="Tell us what you were doing and what you saw." className="rounded-xl bg-surface-container-low px-3 py-3 font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
        </label>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        {done && <p className="font-body-sm text-body-sm text-tertiary">Sent. We will reply here, and you can see it below.</p>}
        <button disabled={busy || message.trim().length < 10} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-40 self-start px-6">
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Your requests</h2>
        {mine === null && <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>}
        {mine?.length === 0 && <p className="font-body-md text-body-md text-on-surface-variant">No requests yet.</p>}
        {mine?.map((r) => (
          <article key={r.id} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${STATUS[r.status].className}`}>{STATUS[r.status].text}</span>
              <span className="font-label-md text-label-md text-on-surface">{SUPPORT_TOPIC_LABEL[r.topic]}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant ml-auto">
                {r.name} · {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{r.message}</p>
            {r.reply && (
              <div className="bg-primary-fixed/20 rounded-xl p-3">
                <p className="font-label-sm text-label-sm text-primary uppercase">Our reply</p>
                <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{r.reply}</p>
              </div>
            )}
          </article>
        ))}
      </section>

      <HelpCenter />
    </div>
  );
}
