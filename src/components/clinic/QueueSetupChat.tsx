'use client';

import { useEffect, useRef, useState } from 'react';
import type { QueueSettings, QueueSetupMessage, QueueSetupTurn } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// Guided Q&A for Queue Rules — first-time clinic setup and later changes. Two places this shows up:
// a modal a doctor/clinic admin opens on demand (skippable, use the form instead), and an inline
// card always visible at the top of a referrer's Clinic & queue rules tab (Decision 27: the referrer
// relays the doctor's answers during onboarding, so the doctor is never separately asked to repeat it).
// Never saves anything itself: a finished chat hands the proposed patch to onApply, which only fills
// the normal QueueRules form fields — the existing Save bar still does the actual save, so permission
// checks, activity logging and validation all stay in one place.
// Anything asked for that isn't an actual setting yet is surfaced via onRequestSetting, which logs it
// for the platform admin to review at owner/setting-requests — it never invents support for it.

interface UnsupportedAsk {
  text: string;
  state: 'idle' | 'sending' | 'sent';
}

export function QueueSetupChat({
  chat,
  onApply,
  onClose,
  onRequestSetting,
  variant = 'modal',
}: {
  chat: (messages: QueueSetupMessage[]) => Promise<QueueSetupTurn>;
  onApply: (patch: Partial<QueueSettings>) => void;
  /** Modal only — inline has no backdrop to dismiss. */
  onClose?: () => void;
  /** Logs an ask for something not yet configurable, for the platform admin to review. Omit to hide the "Request this" button. */
  onRequestSetting?: (description: string) => Promise<unknown>;
  /** 'inline' — a plain card, always visible at the top of Queue Rules. 'modal' (default) — the overlay a doctor/clinic admin opens on demand. */
  variant?: 'modal' | 'inline';
}) {
  const [messages, setMessages] = useState<QueueSetupMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [proposed, setProposed] = useState<Partial<QueueSettings> | null>(null);
  const [applied, setApplied] = useState(false);
  const [unsupportedAsks, setUnsupportedAsks] = useState<UnsupportedAsk[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const send = async (next: QueueSetupMessage[]) => {
    setLoading(true);
    try {
      const turn = await chat(next);
      setMessages([...next, { role: 'assistant', content: turn.reply }]);
      if (turn.done && turn.proposed) setProposed(turn.proposed);
      if (turn.unsupported) setUnsupportedAsks((prev) => [...prev, { text: turn.unsupported!, state: 'idle' }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: "Couldn't reach the AI — use the form below instead." }]);
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    started.current = false;
    setMessages([]);
    setProposed(null);
    setApplied(false);
    setUnsupportedAsks([]);
    setInput('');
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    send([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, proposed, unsupportedAsks]);

  const submit = () => {
    if (!input.trim() || loading) return;
    const next: QueueSetupMessage[] = [...messages, { role: 'user', content: input.trim() }];
    setMessages(next);
    setInput('');
    send(next);
  };

  const requestSetting = async (i: number) => {
    if (!onRequestSetting) return;
    setUnsupportedAsks((prev) => prev.map((a, idx) => (idx === i ? { ...a, state: 'sending' } : a)));
    try {
      await onRequestSetting(unsupportedAsks[i].text);
      setUnsupportedAsks((prev) => prev.map((a, idx) => (idx === i ? { ...a, state: 'sent' } : a)));
    } catch {
      setUnsupportedAsks((prev) => prev.map((a, idx) => (idx === i ? { ...a, state: 'idle' } : a)));
    }
  };

  const body = (
    <>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-3 py-2 font-body-md text-body-md ${
              m.role === 'assistant' ? 'bg-surface-container-low self-start' : 'bg-primary-fixed/30 self-end'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <p className="font-body-sm text-body-sm text-on-surface-variant">Thinking…</p>}

        {unsupportedAsks.map((ask, i) => (
          <div key={i} className="self-start max-w-[90%] bg-secondary-fixed/20 rounded-xl p-3 flex items-center gap-3">
            <Icon name="info" className="text-[18px] shrink-0" />
            <p className="flex-1 font-body-sm text-body-sm">
              Not available yet: <span className="font-medium">{ask.text}</span>
            </p>
            {onRequestSetting &&
              (ask.state === 'sent' ? (
                <span className="font-label-sm text-label-sm text-primary shrink-0">Requested ✓</span>
              ) : (
                <button
                  onClick={() => requestSetting(i)}
                  disabled={ask.state === 'sending'}
                  className="h-8 px-3 rounded-full bg-surface-container-lowest font-label-sm text-label-sm shrink-0 disabled:opacity-60"
                >
                  {ask.state === 'sending' ? 'Sending…' : 'Request this'}
                </button>
              ))}
          </div>
        ))}

        {proposed && (
          <div className="bg-tertiary-fixed/20 rounded-xl p-3 flex flex-col gap-2">
            <p className="font-label-md text-label-md">Proposed settings</p>
            <ul className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
              {Object.entries(proposed).map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium">{k}</span>: {String(v)}
                </li>
              ))}
            </ul>
            {applied ? (
              <p className="font-body-sm text-body-sm text-primary">Applied to the form below — review and save.</p>
            ) : (
              <button
                onClick={() => {
                  onApply(proposed);
                  setApplied(true);
                }}
                className="h-10 rounded-xl bg-primary text-on-primary font-label-md text-label-md mt-1"
              >
                Apply to form
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {(!proposed || variant === 'inline') && (
        <div className="p-3 border-t border-surface-container flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={loading}
            placeholder={proposed ? 'Ask for a change, or something else…' : 'Type your answer…'}
            className="flex-1 h-11 rounded-xl bg-surface-container-low px-3 font-body-md text-body-md focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={loading || !input.trim()}
            className="h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}
      <button
        onClick={variant === 'inline' ? restart : onClose}
        className="text-center py-2 font-body-sm text-body-sm text-on-surface-variant border-t border-surface-container"
      >
        {variant === 'inline' ? 'Start over' : proposed ? 'Close' : "Skip — I'll set it up manually"}
      </button>
    </>
  );

  if (variant === 'inline') {
    return <div className="bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col max-h-[70vh]">{body}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-container">
          <div className="flex items-center gap-2">
            <Icon name="auto_awesome" className="text-primary text-[20px]" />
            <p className="font-label-lg text-label-lg">Set up Queue Rules</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-on-surface-variant">
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
