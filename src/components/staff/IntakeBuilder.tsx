import { useState } from 'react';
import { Icon } from '@/components/patient/ui';

export type IntakeField = {
  id: string;
  type: 'text' | 'select' | 'boolean';
  label: string;
  options?: string[];
  required: boolean;
};

export function IntakeBuilder({
  schema,
  onChange,
}: {
  schema: IntakeField[];
  onChange: (v: IntakeField[]) => void;
}) {
  const [fields, setFields] = useState<IntakeField[]>(schema || []);

  const update = (fn: (old: IntakeField[]) => IntakeField[]) => {
    const next = fn(fields);
    setFields(next);
    onChange(next);
  };

  const addField = (type: 'text' | 'select' | 'boolean') => {
    update((s) => [
      ...s,
      { id: Math.random().toString(36).slice(2), type, label: 'New Question', required: false, options: type === 'select' ? ['Option 1'] : undefined },
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      {fields.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">No custom questions added.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {fields.map((f, i) => (
            <div key={f.id} className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <input
                  className="flex-1 bg-transparent font-label-md text-label-md focus:outline-none border-b border-surface-container-high pb-1"
                  value={f.label}
                  onChange={(e) => update((s) => s.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
                />
                <button type="button" onClick={() => update((s) => s.filter((x) => x.id !== f.id))} className="text-error">
                  <Icon name="delete" className="text-[20px]" />
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => update((s) => s.map((x) => (x.id === f.id ? { ...x, required: e.target.checked } : x)))}
                  /> Required
                </label>
                <span className="font-body-sm text-body-sm text-tertiary uppercase text-[10px] tracking-widest">{f.type}</span>
              </div>

              {f.type === 'select' && (
                <div className="flex flex-col gap-2 mt-2 pl-4 border-l-2 border-surface-container-high">
                  {(f.options || []).map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <input
                        className="flex-1 bg-transparent font-body-sm text-body-sm focus:outline-none"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...(f.options || [])];
                          newOpts[optIdx] = e.target.value;
                          update((s) => s.map((x) => (x.id === f.id ? { ...x, options: newOpts } : x)));
                        }}
                      />
                      <button type="button" onClick={() => {
                        const newOpts = [...(f.options || [])];
                        newOpts.splice(optIdx, 1);
                        update((s) => s.map((x) => (x.id === f.id ? { ...x, options: newOpts } : x)));
                      }}>
                        <Icon name="close" className="text-[16px] text-on-surface-variant" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const newOpts = [...(f.options || []), 'New Option'];
                      update((s) => s.map((x) => (x.id === f.id ? { ...x, options: newOpts } : x)));
                    }}
                    className="self-start text-primary font-label-sm flex items-center gap-1"
                  >
                    <Icon name="add" className="text-[16px]" /> Add Option
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-2">
        <button type="button" onClick={() => addField('text')} className="px-3 py-1.5 rounded-full bg-surface-container-high font-label-sm flex items-center gap-1 hover:bg-surface-container-highest transition-colors">
          <Icon name="short_text" className="text-[16px]" /> Text input
        </button>
        <button type="button" onClick={() => addField('boolean')} className="px-3 py-1.5 rounded-full bg-surface-container-high font-label-sm flex items-center gap-1 hover:bg-surface-container-highest transition-colors">
          <Icon name="check_box" className="text-[16px]" /> Yes / No
        </button>
        <button type="button" onClick={() => addField('select')} className="px-3 py-1.5 rounded-full bg-surface-container-high font-label-sm flex items-center gap-1 hover:bg-surface-container-highest transition-colors">
          <Icon name="arrow_drop_down_circle" className="text-[16px]" /> Dropdown
        </button>
      </div>
    </div>
  );
}
