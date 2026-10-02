import { Icon } from './ui';
import type { IntakeField } from '../staff/IntakeBuilder';

export function CustomIntakeForm({
  schema,
  answers,
  onChange,
}: {
  schema: IntakeField[];
  answers: Record<string, any>;
  onChange: (a: Record<string, any>) => void;
}) {
  if (!schema || schema.length === 0) return null;

  return (
    <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="assignment" className="text-primary text-[20px]" />
        <h3 className="text-label-lg font-label-lg text-on-surface font-semibold">Additional Details</h3>
      </div>
      
      {schema.map((field) => (
        <div key={field.id} className="flex flex-col gap-2">
          <label className="text-label-sm font-label-sm text-on-surface-variant flex gap-1">
            {field.label} {field.required && <span className="text-error">*</span>}
          </label>
          
          {field.type === 'text' && (
            <input
              type="text"
              className="w-full p-3.5 bg-surface-container-low rounded-xl text-body-md font-body-md text-on-surface placeholder:text-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              value={answers[field.id] || ''}
              onChange={(e) => onChange({ ...answers, [field.id]: e.target.value })}
            />
          )}

          {field.type === 'select' && (
            <select
              className="w-full p-3.5 bg-surface-container-low rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              value={answers[field.id] || ''}
              onChange={(e) => onChange({ ...answers, [field.id]: e.target.value })}
            >
              <option value="">Select an option</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {field.type === 'boolean' && (
            <div className="flex gap-3">
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl font-label-md border border-surface-container-high transition-colors ${answers[field.id] === true ? 'bg-primary text-white border-primary' : 'bg-surface-container-lowest text-on-surface'}`}
                onClick={() => onChange({ ...answers, [field.id]: true })}
              >Yes</button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-xl font-label-md border border-surface-container-high transition-colors ${answers[field.id] === false ? 'bg-error text-white border-error' : 'bg-surface-container-lowest text-on-surface'}`}
                onClick={() => onChange({ ...answers, [field.id]: false })}
              >No</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
