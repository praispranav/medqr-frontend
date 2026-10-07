'use client';

import { useState } from 'react';
import { api, ApiError, type DoctorToday } from '@/lib/api';
import { LANG_NAMES, type LangCode } from '@/lib/i18n';
import { Icon } from '@/components/patient/ui';
import { IntakeBuilder, type IntakeField } from '@/components/staff/IntakeBuilder';

// A doctor's own intake questions — asked when a patient joins their queue, answers shown on the
// consultation screen. Its own page and its own Save (it used to share Public Profile's).

export function IntakeFormEditor({
  doctor,
  onSaved,
  save: saveFn = (schema) => api.updateDoctorPublicProfile(doctor.id, { intake_schema: schema }),
  saveLanguage = (lang) => api.updateDoctorPublicProfile(doctor.id, { patient_language: lang }),
  clinicLanguage,
  title = 'Intake Form',
}: {
  doctor: DoctorToday;
  onSaved: () => Promise<void>;
  save?: (schema: IntakeField[]) => Promise<unknown>;
  /** Decision 35: the language this doctor's patients see (null = clinic default). */
  saveLanguage?: (lang: string | null) => Promise<unknown>;
  /** The clinic's default patient language, shown as "Clinic default (…)". */
  clinicLanguage?: string;
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
      <PatientLanguage doctor={doctor} clinicLanguage={clinicLanguage} save={saveLanguage} onSaved={onSaved} />
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

/**
 * Decision 35: the language this doctor's patients see on the check-in form and their live token
 * page. Saved on change. The patient can still switch with the 🌐 button; questions you type
 * yourself show exactly as written, so write them in this language.
 */
function PatientLanguage({
  doctor,
  clinicLanguage,
  save,
  onSaved,
}: {
  doctor: DoctorToday;
  clinicLanguage?: string;
  save: (lang: string | null) => Promise<unknown>;
  onSaved: () => Promise<void>;
}) {
  const own = (doctor.settings_override?.patient_language as string | undefined) ?? '';
  const [value, setValue] = useState(own);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const clinicName = LANG_NAMES[(clinicLanguage as LangCode) ?? 'en'] ?? 'English';
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Icon name="translate" className="text-[22px] text-primary mt-0.5" />
        <div className="flex-1">
          <h2 className="font-headline-sm text-headline-sm">Language your patients see</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            The check-in form and token page open in this language. Patients can still switch with 🌐. Write your own questions below in the same language.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={value}
          disabled={state === 'saving'}
          onChange={async (e) => {
            const next = e.target.value;
            setValue(next);
            setState('saving');
            try {
              await save(next || null);
              await onSaved();
              setState('saved');
            } catch {
              setState('error');
            }
          }}
          className="h-12 min-w-[240px] rounded-xl bg-surface-container-low px-3 font-body-lg text-body-lg"
        >
          <option value="">Clinic default ({clinicName})</option>
          {(Object.entries(LANG_NAMES) as [LangCode, string][]).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        {state === 'saving' && <span className="font-body-sm text-body-sm text-on-surface-variant">Saving…</span>}
        {state === 'saved' && <span className="font-body-sm text-body-sm text-tertiary">Saved ✓</span>}
        {state === 'error' && <span className="font-body-sm text-body-sm text-error">Couldn’t save — try again</span>}
      </div>
    </section>
  );
}
