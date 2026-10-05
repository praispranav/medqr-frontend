'use client';

import { useState } from 'react';
import { api, ApiError, type DoctorToday } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { IntakeBuilder, type IntakeField } from '@/components/staff/IntakeBuilder';

// A doctor's own intake questions — asked when a patient joins their queue, answers shown on the
// consultation screen. Its own page and its own Save (it used to share Public Profile's).

export function IntakeFormEditor({
  doctor,
  onSaved,
  save: saveFn = (schema) => api.updateDoctorPublicProfile(doctor.id, { intake_schema: schema }),
  title = 'Intake Form',
}: {
  doctor: DoctorToday;
  onSaved: () => Promise<void>;
  save?: (schema: IntakeField[]) => Promise<unknown>;
  title?: string;
}) {
  const initial: IntakeField[] = doctor.intake_schema || [];
  const [schema, setSchema] = useState<IntakeField[]>(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(schema) !== JSON.stringify(initial);

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      await saveFn(schema);
      await onSaved();
      setState('saved');
    } catch (e) {
      setState('idle');
      setError(e instanceof ApiError ? e.message : 'Could not save right now.');
    }
  };

  return (
    <div className="max-w-2xl flex flex-col gap-6 pb-10">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Extra questions patients answer when they join your queue. Keep it short — every question is one more thing to type.
        </p>
      </div>
      <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <IntakeBuilder schema={schema} onChange={setSchema} />
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            disabled={!dirty || state === 'saving'}
            onClick={save}
            className="h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-2 disabled:opacity-40"
          >
            <Icon name="save" className="text-[20px]" />
            {state === 'saving' ? 'Saving…' : 'Save intake form'}
          </button>
          {state === 'saved' && !dirty && <p className="font-body-sm text-body-sm text-tertiary">Saved ✓</p>}
        </div>
      </section>
    </div>
  );
}
