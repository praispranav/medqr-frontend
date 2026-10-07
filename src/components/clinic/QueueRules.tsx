'use client';

import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, type PaymentMode, type QueueSettings, type QueueSetupMessage, type QueueSetupTurn, type Tenant } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { QueueSetupChat } from './QueueSetupChat';
import { PATIENT_LANGUAGES_READY } from '@/lib/i18n';

export interface QueueRulesHandle {
  /** Merge a patch (e.g. from an inline AI chat rendered above this component) into the unsaved form state. */
  applyPatch: (patch: Partial<QueueSettings>) => void;
}

// Screen #9 — Booking Mode & Queue Rules. Ported from
// stitch_medqr_clinic_suite_ui_design/booking_mode_queue_rules/code.html.
// Saves to PATCH /tenants/:id/queue-settings. Only settings the queue engine actually honours are
// editable. Left out until they exist in the engine: slot interleaving orchestrator, no-show
// grace/auto-actions, priority jump rules, auto-advance timer. Time-slot/Hybrid show as locked
// add-ons (the patient flow is token-only today).


const PAYMENT_OPTIONS: { value: PaymentMode; title: string; body: string; badge?: string }[] = [
  {
    value: 'cash_at_counter',
    title: 'Cash / UPI at counter',
    badge: 'Simplest',
    body: 'Patient pays reception in person. Reception marks Paid on the check-in screen.',
  },
  {
    value: 'prepay_remote_only',
    title: 'Prepay for remote bookings only',
    body: 'Walk-ins pay at the counter. Patients booking from home pay online first.',
  },
  {
    value: 'prepay_always',
    title: 'Prepay always',
    body: 'Every patient pays online before a token is issued.',
  },
  {
    value: 'pay_after_consultation',
    title: 'Pay after consultation',
    body: 'Fee is decided and collected when the visit ends — you mark it paid on the consultation screen.',
  },
];

export const QueueRules = forwardRef<QueueRulesHandle, {
  tenant: Tenant;
  onSaved: () => Promise<void>;
  /** Platform admin passes its own (x-admin-key) save; clinic screens use the staff session. */
  save?: (patch: Partial<QueueSettings>) => Promise<unknown>;
  /** Platform admin/referrer pass their own session; clinic screens use the staff session. */
  chat?: (messages: QueueSetupMessage[]) => Promise<QueueSetupTurn>;
  /** Logs an ask from the chat for something not yet configurable. Platform admin passes its own session; clinic screens use the staff session. */
  requestSetting?: (description: string) => Promise<unknown>;
  /** Hide the inline "Set up with AI" button — e.g. a referrer page instead shows an always-visible inline chat above this component. */
  hideSetupButton?: boolean;
}>(function QueueRules(
  {
    tenant,
    onSaved,
    save: saveFn = (patch) => api.updateQueueSettings(tenant.id, patch),
    chat: chatFn = (messages) => api.queueSetupChat(tenant.id, messages),
    requestSetting: requestSettingFn = (description) => api.requestSetting(tenant.id, description),
    hideSetupButton = false,
  },
  ref,
) {
  const original = tenant.queue_settings;
  const [s, setS] = useState<QueueSettings>(original);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [setupOpen, setSetupOpen] = useState(false);
  const clinicName = tenant.display_name ?? tenant.subdomain;

  useImperativeHandle(ref, () => ({
    applyPatch: (patch) => {
      setS((x) => ({ ...x, ...patch }));
      setState('idle');
    },
  }));

  const patch = useMemo(() => {
    const out: Partial<QueueSettings> = {};
    (Object.keys(s) as (keyof QueueSettings)[]).forEach((k) => {
      if (JSON.stringify(s[k]) !== JSON.stringify(original[k])) (out as Record<string, unknown>)[k] = s[k];
    });
    return out;
  }, [s, original]);
  const dirty = Object.keys(patch).length > 0;

  const set = <K extends keyof QueueSettings>(k: K, v: QueueSettings[K]) => {
    setS((x) => ({ ...x, [k]: v }));
    setState('idle');
  };

  const save = async () => {
    setState('saving');
    try {
      await saveFn(patch);
      await onSaved();
      setState('saved');
    } catch {
      setState('error');
    }
  };

  const slotAddOn = !!tenant.entitlements.time_slot_booking;
  const onlinePrepay = s.payment_mode === 'prepay_always' || s.payment_mode === 'prepay_remote_only';

  return (
    <div className="max-w-5xl flex flex-col gap-6 pb-28">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-primary-fixed/50 text-on-primary-fixed-variant font-label-sm text-label-sm uppercase">
            OPD engine
          </span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mt-2">Queue rules &amp; booking modes</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">How tokens are issued and advanced at {clinicName}.</p>
        </div>
        {!hideSetupButton && (
          <button
            onClick={() => setSetupOpen(true)}
            className="h-11 px-4 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md flex items-center gap-2 shrink-0"
          >
            <Icon name="auto_awesome" className="text-[18px]" /> Set up with AI
          </button>
        )}
      </div>
      {setupOpen && (
        <QueueSetupChat
          chat={chatFn}
          onRequestSetting={requestSettingFn}
          onClose={() => setSetupOpen(false)}
          onApply={(patch) => {
            setS((x) => ({ ...x, ...patch }));
            setState('idle');
          }}
        />
      )}

      {/* Booking mode */}
      <Section title="Booking mode" subtitle="How patients get their place in line.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ModeCard
            icon="format_list_numbered"
            title="Token only"
            body="Walk-in tokens in join order. Best for busy morning OPDs."
            badge="Included"
            active={s.booking_mode === 'token'}
            onClick={() => set('booking_mode', 'token')}
          />
          <ModeCard
            icon="event_available"
            title="Time-slot only"
            body="Fixed appointment slots booked in advance."
            badge="+₹299/mo"
            locked={!slotAddOn}
            active={s.booking_mode === 'time_slot'}
            onClick={() => set('booking_mode', 'time_slot')}
          />
          <ModeCard
            icon="call_split"
            title="Hybrid"
            body="Weaves booked appointments into the walk-in token flow."
            badge="+₹299/mo"
            locked={!slotAddOn}
            active={s.booking_mode === 'hybrid'}
            onClick={() => set('booking_mode', 'hybrid')}
          />
        </div>
        {!slotAddOn && (
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-3">
            Time-slot and Hybrid need the Time-Slot / Hybrid Booking add-on (coming soon).
          </p>
        )}
      </Section>

      <Section title="How your shift starts" subtitle="Nobody — you or reception — can call a patient until your shift is live.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Radio
            checked={s.shift_start_mode !== 'auto'}
            onChange={() => set('shift_start_mode', 'manual')}
            title="I tap “Start shift”"
            badge="Recommended"
            body="The queue goes live when you (or reception, with “Doctor has arrived”) start it. Patients who come early wait as “Arrived early”."
          />
          <Radio
            checked={s.shift_start_mode === 'auto'}
            onChange={() => set('shift_start_mode', 'auto')}
            title="Automatically from my consulting hours"
            body="Live during the hours in My Hours (e.g. 5–9 PM). Breaks and End shift still work with one tap."
          />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Advance behaviour */}
        <Section title="Who calls the next patient" subtitle="What moves the queue forward.">
          <div className="flex flex-col gap-2">
            <Radio
              checked={s.advance_mode === 'manual'}
              onChange={() => set('advance_mode', 'manual')}
              title="Doctor — I tap “Complete & call next”"
              badge="Recommended"
              body="Full control from the doctor's My Queue screen. Patients' phones update the moment you call."
            />
            <Radio
              checked={s.advance_mode === 'reception'}
              onChange={() => set('advance_mode', 'reception')}
              title="Reception desk calls patients in"
              body="Front-desk staff get a “Call next” button per doctor. The doctor's screen shows the queue without call buttons."
            />
            <Radio
              checked={s.advance_mode === 'both'}
              onChange={() => set('advance_mode', 'both')}
              title="Both — doctor or reception"
              body="Whoever is free calls the next patient: the doctor from their screen, or reception with “Call next”."
            />
            <Radio checked={false} disabled onChange={() => {}} title="Auto-advance on a timer" body="Not available yet." />
            
            <div className="mt-4 border-t border-surface-container pt-4">
              <NumberField
                label="Get next N ready"
                suffix="patients"
                value={s.ready_count ?? 3}
                min={0}
                max={10}
                onChange={(v) => set('ready_count', v)}
                hint="Send a web push alert to the next N waiting patients when a token is called. 0 = off."
              />
            </div>
          </div>
        </Section>

        {/* Pace */}
        <Section title="Pace & capacity" subtitle="Used for the wait times patients see.">
          <div className="flex flex-col gap-4">
            <NumberField
              label="Average consultation"
              suffix="min"
              value={s.avg_consult_mins}
              min={1}
              max={60}
              onChange={(v) => set('avg_consult_mins', v)}
              hint="Patients see “~N min wait” = patients ahead × this."
            />
            <NumberField
              label="Max tokens per doctor per day"
              suffix="tokens"
              value={s.max_daily_tokens}
              min={1}
              max={999}
              onChange={(v) => set('max_daily_tokens', v)}
              hint="New joins are refused with a polite message once reached."
            />
          </div>
        </Section>
      </div>

      <Section title="Patient self check-in" subtitle="What patients do after scanning the clinic QR.">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="font-label-lg text-label-lg text-on-surface">Verify patients&apos; mobile with a WhatsApp code</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Off = fastest: patients just type name and number. On = they confirm a 6-digit code on WhatsApp first
              (stops fake numbers; needs WhatsApp connected).
            </p>
          </div>
          <Toggle checked={!!s.require_whatsapp_otp} onChange={(v) => set('require_whatsapp_otp', v)} />
        </label>
      </Section>

{PATIENT_LANGUAGES_READY && (
      <Section title="Patient language" subtitle="The default language for patient screens.">
        <div className="max-w-xs">
          <select
            value={s.patient_language ?? 'en'}
            onChange={(e) => set('patient_language', e.target.value as any)}
            className="w-full h-12 rounded-xl bg-surface-container-low px-4 font-body-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="ml">മലയാളം (Malayalam)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="kn">ಕನ್ನಡ (Kannada)</option>
            <option value="bn">বাংলা (Bengali)</option>
            <option value="gu">ગુજરાતી (Gujarati)</option>
          </select>
        </div>
      </Section>
      )}

      {/* Decision 17 */}
      <Section title="Advance booking" subtitle="Let patients join your queue for a future day, not just today.">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="font-label-lg text-label-lg text-on-surface">Allow booking ahead</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Off by default (today only). Even when on, patients can only book a day you&apos;ve actually scheduled a
              session for in My Hours — this never invents availability that isn&apos;t really there.
            </p>
          </div>
          <Toggle checked={(s.advance_booking_days ?? 0) > 0} onChange={(v) => set('advance_booking_days', v ? 1 : 0)} />
        </label>
        {(s.advance_booking_days ?? 0) > 0 && (
          <div className="mt-4">
            <NumberField
              label="How many days ahead"
              suffix="days"
              value={s.advance_booking_days ?? 1}
              min={1}
              max={7}
              onChange={(v) => set('advance_booking_days', v)}
              hint="Doctor Selection shows this many upcoming days, only for the ones you're actually scheduled on."
            />
          </div>
        )}
      </Section>

      {/* Decision 2 & 19 */}
      <Section title="Reception check-in" subtitle="">
        <div className="flex flex-col gap-6">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-label-lg text-label-lg text-on-surface">Front desk verifies arrivals</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                If off, patients join straight into the live queue. If on, reception must click Verify first.
              </p>
            </div>
            <Toggle checked={s.front_desk_verifies_arrivals !== false} onChange={(v) => set('front_desk_verifies_arrivals', v)} />
          </label>
          {s.front_desk_verifies_arrivals === false && (
            <label className="flex items-center justify-between gap-4 cursor-pointer pl-4 border-l-2 border-primary/30">
              <div>
                <p className="font-label-lg text-label-lg text-on-surface">Patients confirm arrival by scanning the clinic QR</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Put up the <strong>Arrival QR</strong> poster (QR Standee page). Patients scan it when they reach the clinic, and only
                  then can the doctor call them with “Call next”. Off = everyone who joins is treated as already here.
                </p>
              </div>
              <Toggle checked={!!s.arrival_scan_required} onChange={(v) => set('arrival_scan_required', v)} />
            </label>
          )}
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="font-label-lg text-label-lg text-on-surface">Offer “Print token slip” after check-in</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                When off, reception only verifies — saves paper for WhatsApp-first clinics.
              </p>
            </div>
            <Toggle checked={s.print_slip_on_checkin} onChange={(v) => set('print_slip_on_checkin', v)} />
          </label>
        </div>
      </Section>
      
      {/* Decision 19 - Late arrivals */}
      <Section title="Late arrivals" subtitle="When a patient misses their turn and shows up later.">
        <div className="flex flex-col gap-3">
          <Radio
            checked={s.late_arrival_priority === 'keep_position'}
            onChange={() => set('late_arrival_priority', 'keep_position')}
            title="Keep original position"
            body="They immediately become the next patient to be called."
          />
          <Radio
            checked={s.late_arrival_priority === 'insert_after_n' || !s.late_arrival_priority}
            onChange={() => set('late_arrival_priority', 'insert_after_n')}
            title="Insert a few tokens down"
            badge="Recommended"
            body="They are placed slightly behind the current active queue."
          />
          {(s.late_arrival_priority === 'insert_after_n' || !s.late_arrival_priority) && (
            <div className="ml-8 mb-2">
              <NumberField
                label="Tokens to wait"
                suffix="tokens"
                value={s.late_arrival_insert_after ?? 5}
                min={1}
                max={20}
                onChange={(v) => set('late_arrival_insert_after', v)}
                hint="How many waiting patients go before them."
              />
            </div>
          )}
          <Radio
            checked={s.late_arrival_priority === 'back_of_queue'}
            onChange={() => set('late_arrival_priority', 'back_of_queue')}
            title="Move to back of queue"
            body="They have to wait for everyone currently in the clinic."
          />
        </div>
      </Section>

      {/* Decision 8 */}
      <Section title="Consultation fee payment" subtitle={`How fees are collected at ${clinicName}.`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PAYMENT_OPTIONS.map((o) => (
            <Radio
              key={o.value}
              checked={s.payment_mode === o.value}
              onChange={() => set('payment_mode', o.value)}
              title={o.title}
              badge={o.badge}
              body={o.body}
            />
          ))}
        </div>
        <label className="mt-4 flex items-center justify-between gap-4 cursor-pointer bg-surface-container-low rounded-xl p-4">
          <div>
            <p className="font-label-lg text-label-lg text-on-surface">Let patients pay online (UPI)</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Patients choose “Pay online” or “Cash at counter” on their phone. Reception and you can also show a UPI QR.
            </p>
          </div>
          <Toggle checked={s.offer_online_payment !== false} onChange={(v) => set('offer_online_payment', v)} />
        </label>
        {onlinePrepay && s.offer_online_payment === false && (
          <p className="mt-3 flex items-start gap-2 bg-secondary-fixed/30 rounded-xl p-3 font-body-sm text-body-sm text-on-secondary-fixed-variant">
            <Icon name="info" className="text-[18px] mt-0.5" />
            Online payment is off, so prepay clinics collect at the counter instead — nobody is ever blocked from being seen.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-4 bg-surface-container-low rounded-xl p-4">
          <div>
            <p className="font-label-lg text-label-lg">Default consultation fee</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Can be changed per visit on the consultation screen.</p>
          </div>
          <div className="flex items-center bg-surface-container-lowest rounded-xl px-3 h-12 w-36">
            <span className="font-label-lg text-label-lg text-on-surface-variant">₹</span>
            <input
              inputMode="numeric"
              value={s.default_consultation_fee_inr}
              onChange={(e) => set('default_consultation_fee_inr', Number(e.target.value.replace(/\D/g, '').slice(0, 6)) || 0)}
              className="w-full bg-transparent px-1 font-headline-sm text-headline-sm focus:outline-none"
            />
          </div>
        </div>
      </Section>

      {/* Save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container">
        <div className="max-w-5xl px-4 lg:px-6 py-3 flex items-center gap-3">
          <p className="flex-1 font-body-sm text-body-sm text-on-surface-variant">
            {state === 'saved'
              ? 'Saved ✓ — applies to new tokens right away.'
              : state === 'error'
                ? "Couldn't save. Check the connection and try again."
                : dirty
                  ? 'You have unsaved changes.'
                  : 'Changes apply to new tokens immediately; existing token numbers stay the same.'}
          </p>
          <button
            disabled={!dirty || state === 'saving'}
            onClick={() => setS(original)}
            className="h-11 px-4 rounded-xl font-label-md text-label-md text-on-surface-variant disabled:opacity-40"
          >
            Discard
          </button>
          <button
            disabled={!dirty || state === 'saving'}
            onClick={save}
            className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-40"
          >
            <Icon name="save" className="text-[20px]" />
            {state === 'saving' ? 'Saving…' : 'Save queue settings'}
          </button>
        </div>
      </div>
    </div>
  );
});

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
      {subtitle && <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  );
}

function ModeCard({
  icon,
  title,
  body,
  badge,
  active,
  locked = false,
  onClick,
}: {
  icon: string;
  title: string;
  body: string;
  badge: string;
  active: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={locked}
      onClick={onClick}
      className={`text-left rounded-xl p-4 flex flex-col gap-2 transition-all ${
        active ? 'bg-primary-fixed/20 ring-2 ring-primary' : 'bg-surface-container-low hover:bg-surface-container'
      } ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="w-10 h-10 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center">
          <Icon name={locked ? 'lock' : icon} className="text-[22px]" />
        </span>
        <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest font-label-sm text-label-sm text-on-surface-variant">{badge}</span>
      </div>
      <p className="font-label-lg text-label-lg text-on-surface">{title}</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{body}</p>
      {active && <span className="font-label-sm text-label-sm text-primary">● Active</span>}
    </button>
  );
}

function Radio({
  checked,
  onChange,
  title,
  body,
  badge,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  body: string;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl ${checked ? 'bg-primary-fixed/20' : 'bg-surface-container-low'} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <input type="radio" checked={checked} disabled={disabled} onChange={onChange} className="mt-1 h-4 w-4 accent-primary" />
      <div>
        <p className="font-label-lg text-label-lg text-on-surface flex items-center gap-2 flex-wrap">
          {title}
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed/60 text-on-tertiary-fixed-variant font-label-sm text-label-sm">{badge}</span>
          )}
        </p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{body}</p>
      </div>
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${checked ? 'bg-primary' : 'bg-surface-container-high'}`}
    >
      <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : ''}`} />
    </button>
  );
}

function NumberField({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-label-lg text-label-lg text-on-surface">{label}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{hint}</p>
      </div>
      <div className="flex items-center gap-1 bg-surface-container-low rounded-xl p-1 shrink-0">
        <button type="button" onClick={() => onChange(clamp(value - 1))} className="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center" aria-label={`Decrease ${label}`}>
          <Icon name="remove" className="text-[18px]" />
        </button>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value.replace(/\D/g, '')) || min))}
          className="w-12 text-center bg-transparent font-headline-sm text-headline-sm focus:outline-none"
        />
        <button type="button" onClick={() => onChange(clamp(value + 1))} className="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center" aria-label={`Increase ${label}`}>
          <Icon name="add" className="text-[18px]" />
        </button>
        <span className="font-body-sm text-body-sm text-on-surface-variant pr-2">{suffix}</span>
      </div>
    </div>
  );
}
