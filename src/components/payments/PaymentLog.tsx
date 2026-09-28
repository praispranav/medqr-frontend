'use client';

import type { PaymentEvent } from '@/lib/api';
import { Icon } from '@/components/patient/ui';

// The append-only payment trail (payment_events) — same wording on reception, doctor and the Payments page.

const LABEL: Record<PaymentEvent['type'], { text: (e: PaymentEvent) => string; icon: string; tone: string }> = {
  choice_online: { text: () => 'Patient chose to pay online', icon: 'smartphone', tone: 'text-on-surface-variant' },
  choice_cash: { text: () => 'Patient chose cash at counter', icon: 'payments', tone: 'text-on-surface-variant' },
  qr_created: { text: () => 'UPI QR created', icon: 'qr_code_2', tone: 'text-on-surface-variant' },
  qr_abandoned: { text: () => 'QR cancelled', icon: 'block', tone: 'text-on-surface-variant' },
  qr_expired: { text: () => 'QR expired unpaid', icon: 'timer_off', tone: 'text-secondary' },
  paid_online: { text: () => 'Paid online (UPI)', icon: 'check_circle', tone: 'text-tertiary' },
  marked_paid: {
    text: (e) => `Marked paid · ${e.method === 'upi_counter' ? 'UPI at counter' : 'Cash'}`,
    icon: 'check_circle',
    tone: 'text-tertiary',
  },
  unmarked_paid: { text: () => 'Payment undone', icon: 'undo', tone: 'text-secondary' },
  fee_changed: { text: () => 'Fee changed', icon: 'edit', tone: 'text-on-surface-variant' },
  duplicate_payment: { text: () => 'Paid twice — refund needed', icon: 'report', tone: 'text-error' },
};

const WHO: Record<PaymentEvent['actor_type'], string> = {
  patient: 'patient',
  reception: 'reception',
  doctor: 'doctor',
  system: 'MedQR',
  razorpay: 'Razorpay',
};

export function PaymentLog({ events, showPatient = false }: { events: PaymentEvent[]; showPatient?: boolean }) {
  if (events.length === 0) return <p className="font-body-sm text-body-sm text-on-surface-variant">No payment activity yet.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {events.map((e) => {
        const l = LABEL[e.type];
        return (
          <li key={e.id} className={`flex items-start gap-2.5 ${e.type === 'duplicate_payment' ? 'bg-error-container/40 rounded-lg p-2' : ''}`}>
            <Icon name={l.icon} className={`text-[18px] mt-0.5 ${l.tone}`} />
            <div className="flex-1 min-w-0">
              <p className={`font-label-md text-label-md ${e.type === 'duplicate_payment' ? 'text-error' : 'text-on-surface'}`}>
                {showPatient && (
                  <span className="text-primary">
                    #{e.token_number} {e.patient_name ?? ''} ·{' '}
                  </span>
                )}
                {l.text(e)}
                {e.amount_inr !== null && ` · ₹${Number(e.amount_inr).toLocaleString('en-IN')}`}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {new Date(e.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · by{' '}
                {e.actor_name && e.actor_type !== 'system' && e.actor_type !== 'razorpay' && e.actor_type !== 'patient'
                  ? `${e.actor_name} (${WHO[e.actor_type]})`
                  : WHO[e.actor_type]}
                {e.doctor_name && showPatient ? ` · ${e.doctor_name}` : ''}
                {e.note ? ` · ${e.note}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
