'use client';

import { useId, useMemo, useState } from 'react';
import { Icon } from '@/components/patient/ui';
import { toTitleCase } from '@/lib/titleCase';
import type { TeamApi } from './TeamManager';

export interface ParsedDoctor {
  name: string;
  qualification: string;
  specialty: string;
  cabin_label: string;
  fee?: number;
}

export function parseDoctorsInput(raw: string): ParsedDoctor[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // 1. Try parsing as JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const items: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.doctors)
        ? parsed.doctors
        : [];

      if (items.length > 0) {
        const list: ParsedDoctor[] = [];
        for (const item of items) {
          const name = String(item?.name || item?.doctor_name || item?.doctorName || '').trim();
          if (!name) continue;
          const qualification = String(item?.qualification || item?.qualifications || '').trim();
          const specialty = String(item?.specialty || item?.department || item?.category || '').trim();
          const cabin_label = String(item?.cabin_label || item?.cabin || '').trim();
          const rawFee = item?.consultation_fee_inr ?? item?.consultation_fee ?? item?.fee ?? item?.fees;
          const feeNum = rawFee != null ? Number(String(rawFee).replace(/[^0-9]/g, '')) : undefined;
          const fee = feeNum != null && Number.isFinite(feeNum) && feeNum > 0 ? feeNum : undefined;

          list.push({
            name: toTitleCase(name),
            qualification,
            specialty,
            cabin_label,
            fee,
          });
        }
        if (list.length > 0) return list;
      }
    } catch {
      // Not valid JSON, continue to line-by-line parsing
    }
  }

  // 2. Line-by-line parsing (pipe, tab, comma, markdown tables)
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: ParsedDoctor[] = [];

  for (const line of lines) {
    // Skip markdown table dividers like |---|---|
    if (/^[|\s-]+$/.test(line)) continue;

    // Detect delimiter
    let parts: string[];
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes('|')) {
      parts = line.split('|');
    } else if (line.includes(',')) {
      parts = line.split(',');
    } else {
      parts = [line];
    }

    parts = parts.map((p) => p.trim()).filter((p) => p.length > 0);
    if (!parts.length) continue;

    // Skip table header rows
    const firstLower = parts[0].toLowerCase();
    if (
      firstLower === 'name' ||
      firstLower === 'doctor' ||
      firstLower === 'doctor name' ||
      firstLower === '#' ||
      firstLower === 'sr' ||
      firstLower === 'sr.' ||
      firstLower === 'department'
    ) {
      continue;
    }

    // Strip leading row numbers (e.g., "1", "1.")
    if (/^\d+\.?$/.test(parts[0]) && parts.length > 1) {
      parts.shift();
    }

    if (!parts.length) continue;

    const name = toTitleCase(parts[0]);
    let qualification = '';
    let specialty = '';
    let fee: number | undefined;

    // Look for fee anywhere in the parts
    let feeIndex = -1;
    for (let i = 1; i < parts.length; i++) {
      const cleanFee = parts[i].replace(/[₹rsINR\s/,-]/gi, '');
      if (/^\d{2,6}$/.test(cleanFee)) {
        fee = parseInt(cleanFee, 10);
        feeIndex = i;
        break;
      }
    }

    // Remaining non-fee text columns
    const textParts = parts.slice(1).filter((_, idx) => idx + 1 !== feeIndex);
    if (textParts.length >= 2) {
      // Check which one is qualification vs specialty
      const isPart0Qual = /mbbs|md|ms|dnb|bds|mds|bhms|bams|dch|dm|mch|diploma/i.test(textParts[0]);
      const isPart1Qual = /mbbs|md|ms|dnb|bds|mds|bhms|bams|dch|dm|mch|diploma/i.test(textParts[1]);

      if (isPart1Qual && !isPart0Qual) {
        specialty = textParts[0];
        qualification = textParts[1];
      } else {
        qualification = textParts[0];
        specialty = textParts[1];
      }
    } else if (textParts.length === 1) {
      if (/mbbs|md|ms|dnb|bds|mds|bhms|bams|dch|dm|mch|diploma/i.test(textParts[0])) {
        qualification = textParts[0];
      } else {
        specialty = textParts[0];
      }
    }

    if (name) {
      results.push({
        name,
        qualification,
        specialty,
        cabin_label: '',
        fee,
      });
    }
  }

  return results;
}

export function BulkDoctorImportModal({
  api,
  onClose,
  onImported,
}: {
  api: TeamApi;
  onClose: () => void;
  onImported: (firstDoctorId?: string) => Promise<void>;
}) {
  const [rawText, setRawText] = useState('');
  const [listPublicly, setListPublicly] = useState(!!api.directoryFields);
  const [applyFee, setApplyFee] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const parsed = useMemo(() => parseDoctorsInput(rawText), [rawText]);

  const handleImport = async () => {
    if (!parsed.length) return;
    setBusy(true);
    setError(null);
    setProgress({ current: 0, total: parsed.length, name: '' });

    let firstCreatedId: string | undefined;
    let completed = 0;
    const failures: string[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const doc = parsed[i];
      setProgress({ current: i + 1, total: parsed.length, name: doc.name });

      try {
        const created = await api.createDoctor({
          name: doc.name,
          qualification: doc.qualification,
          specialty: doc.specialty,
          cabin_label: doc.cabin_label,
          is_publicly_listed: listPublicly,
        });

        if (!firstCreatedId) firstCreatedId = created.id;

        // Apply consultation fee override if present and enabled
        if (applyFee && doc.fee && api.doctorSettings?.save) {
          try {
            await api.doctorSettings.save(created.id, {
              default_consultation_fee_inr: doc.fee,
            });
          } catch (feeErr) {
            console.warn(`Could not set fee for ${doc.name}:`, feeErr);
          }
        }

        completed++;
      } catch (err) {
        failures.push(`${doc.name}: ${(err as Error).message || 'Failed'}`);
      }
    }

    setBusy(false);
    setProgress(null);

    if (failures.length > 0) {
      setError(`Imported ${completed} of ${parsed.length} doctors. Errors:\n${failures.join('\n')}`);
    }

    if (completed > 0) {
      setSuccessCount(completed);
      await onImported(firstCreatedId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-container">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="group_add" className="text-[22px]" />
            </div>
            <div>
              <h2 className="font-title-md text-title-md font-semibold">Bulk Import Doctors</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Paste JSON or tab/pipe-delimited text to add multiple doctors at once
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto min-h-0">
          {successCount !== null ? (
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-5 text-center flex flex-col items-center gap-2">
              <Icon name="check_circle" className="text-[36px] text-primary" />
              <p className="font-title-sm text-title-sm font-medium text-primary">
                Successfully imported {successCount} doctor{successCount === 1 ? '' : 's'}!
              </p>
              <button
                onClick={onClose}
                className="mt-2 h-10 px-5 rounded-xl bg-primary text-white font-label-md text-label-md hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-xl bg-error-container/40 border border-error/20 p-3 text-error font-body-sm text-body-sm whitespace-pre-line">
                  {error}
                </div>
              )}

              {/* Paste Textarea */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-label-md text-label-md font-medium">
                    Paste Details (JSON or Lines)
                  </label>
                  {rawText && (
                    <button
                      type="button"
                      onClick={() => setRawText('')}
                      className="text-xs text-on-surface-variant hover:text-error"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Paste JSON array:\n[{"name": "Dr. S. Alam", "qualification": "MBBS, MD", "specialty": "Medicine", "fee": 400}, ...]\n\nOR plain text lines:\nDr. S. Alam | MBBS, MD | Department of Medicine | 400\nDr. Sanjesh Mani | MBBS | Department of Medicine | 300`}
                  rows={6}
                  className="w-full rounded-xl bg-surface-container-low p-3 font-mono text-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/30 border border-outline-variant/50"
                  disabled={busy}
                />
              </div>

              {/* Preview Section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md font-medium flex items-center gap-1.5">
                    Preview
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        parsed.length > 0
                          ? 'bg-primary-container text-white'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {parsed.length} {parsed.length === 1 ? 'doctor' : 'doctors'} detected
                    </span>
                  </span>
                </div>

                {parsed.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-surface-container-high">
                    <table className="w-full text-left font-body-sm text-body-sm border-collapse">
                      <thead className="bg-surface-container sticky top-0 font-label-sm text-label-sm text-on-surface-variant">
                        <tr>
                          <th className="p-2.5 pl-3">#</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Qualification</th>
                          <th className="p-2.5">Specialty</th>
                          <th className="p-2.5 pr-3 text-right">Fee (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container">
                        {parsed.map((doc, idx) => (
                          <tr key={idx} className="hover:bg-surface-container-low">
                            <td className="p-2.5 pl-3 text-on-surface-variant text-xs">{idx + 1}</td>
                            <td className="p-2.5 font-medium">{doc.name}</td>
                            <td className="p-2.5 text-on-surface-variant">{doc.qualification || '—'}</td>
                            <td className="p-2.5 text-on-surface-variant">{doc.specialty || '—'}</td>
                            <td className="p-2.5 pr-3 text-right font-mono">
                              {doc.fee ? `₹${doc.fee}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-outline-variant/60 p-5 text-center text-on-surface-variant text-body-sm">
                    No doctors detected yet. Paste details above to preview parsed rows.
                  </div>
                )}
              </div>

              {/* Import Options */}
              <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-surface-container">
                {api.directoryFields && (
                  <label className="flex items-center gap-2 cursor-pointer font-label-md text-label-md text-on-surface">
                    <input
                      type="checkbox"
                      checked={listPublicly}
                      onChange={(e) => setListPublicly(e.target.checked)}
                      className="rounded accent-primary w-4 h-4"
                      disabled={busy}
                    />
                    List doctors in public directory
                  </label>
                )}
                {api.doctorSettings && (
                  <label className="flex items-center gap-2 cursor-pointer font-label-md text-label-md text-on-surface">
                    <input
                      type="checkbox"
                      checked={applyFee}
                      onChange={(e) => setApplyFee(e.target.checked)}
                      className="rounded accent-primary w-4 h-4"
                      disabled={busy}
                    />
                    Apply consultation fee overrides
                  </label>
                )}
              </div>

              {/* Progress Bar */}
              {progress && (
                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container">
                  <div className="flex justify-between font-label-sm text-label-sm">
                    <span>
                      Importing {progress.current} of {progress.total}: {progress.name}
                    </span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {successCount === null && (
          <div className="p-4 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="h-10 px-4 rounded-xl hover:bg-surface-container font-label-md text-label-md text-on-surface-variant disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={busy || parsed.length === 0}
              className="h-10 px-5 rounded-xl bg-primary text-white font-label-md text-label-md flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 shadow-sm"
            >
              {busy ? (
                <>
                  <Icon name="progress_activity" className="animate-spin text-[18px]" />
                  Importing…
                </>
              ) : (
                <>
                  <Icon name="upload" className="text-[18px]" />
                  Import {parsed.length > 0 ? `${parsed.length} Doctors` : 'Doctors'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
