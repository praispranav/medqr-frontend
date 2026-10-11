'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, type PatientDetails } from '@/lib/api';
import { Icon } from '@/components/patient/ui';
import { useT } from '@/lib/i18n';

// Decision 38 — on the token page, a patient can still change the basics they filled in (reason, weight,
// their own photos/reports) until they are called in. Hidden once the visit has started. Other vitals
// (BP, temperature, SpO2) stay with reception (Decision 5).

export function EditMyDetails({ tokenId }: { tokenId: string }) {
  const { t } = useT();
  const [details, setDetails] = useState<PatientDetails | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState<'save' | 'upload' | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const apply = (d: PatientDetails) => {
    setDetails(d);
    setReason(d.chief_complaint ?? '');
    setWeight(d.weight_kg != null ? String(d.weight_kg) : '');
  };
  useEffect(() => {
    api.patientDetails(tokenId).then(apply).catch(() => setDetails(null));
  }, [tokenId]);

  if (!details?.editable) return null;

  const save = async () => {
    setBusy('save');
    setMsg(null);
    try {
      const w = weight.trim();
      apply(await api.updatePatientDetails(tokenId, { chief_complaint: reason.trim() || null, weight_kg: w ? Number(w) : null }));
      setMsg({ kind: 'ok', text: t('ed_saved') });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : t('ed_error') });
    } finally {
      setBusy(null);
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy('upload');
    setMsg(null);
    try {
      for (const f of Array.from(files)) {
        const up = await api.uploadFile(f);
        await api.addPatientAttachment(tokenId, { url: up.url, name: up.name });
      }
      apply(await api.patientDetails(tokenId));
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : t('ed_error') });
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async (url: string) => {
    setMsg(null);
    try {
      apply(await api.removePatientPhoto(tokenId, url));
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : t('ed_error') });
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-[48px] bg-surface-container-lowest rounded-2xl px-4 shadow-sm flex items-center gap-3 text-left touch-manipulation active:scale-[0.99]"
      >
        <Icon name="edit_note" className="text-primary text-[24px]" />
        <span className="font-label-lg text-label-lg text-primary flex-1">{t('ed_title')}</span>
        <Icon name="expand_more" className="text-on-surface-variant" />
      </button>
    );
  }

  const input = 'w-full rounded-xl bg-surface-container-low px-3 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30';
  return (
    <div className="w-full bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-4">
      <button type="button" onClick={() => setOpen(false)} className="flex items-center gap-3 text-left">
        <Icon name="edit_note" className="text-primary text-[24px]" />
        <span className="flex-1">
          <span className="block font-label-lg text-label-lg text-on-surface">{t('ed_title')}</span>
          <span className="block font-body-sm text-body-sm text-on-surface-variant">{t('ed_hint')}</span>
        </span>
        <Icon name="expand_less" className="text-on-surface-variant" />
      </button>

      <label className="flex flex-col gap-1">
        <span className="font-label-md text-label-md text-on-surface-variant">{t('ed_reason')}</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder={t('ed_reason_ph')} className={input} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-label-md text-label-md text-on-surface-variant">{t('ed_weight')}</span>
        <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))} placeholder="e.g. 70" className={input} />
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-label-md text-label-md text-on-surface-variant">{t('ed_photos')}</span>
        {details.photos.map((p) => (
          <div key={p.url} className="bg-surface-container-low p-3 rounded-xl flex items-center justify-between gap-3">
            <span className="font-label-md text-label-md text-on-surface truncate">{p.name}</span>
            <button type="button" aria-label={`${t('ed_remove')} ${p.name}`} onClick={() => removePhoto(p.url)} className="w-9 h-9 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-error flex items-center justify-center shrink-0">
              <Icon name="delete" className="text-[18px]" />
            </button>
          </div>
        ))}
        <label className="min-h-[48px] rounded-xl border-2 border-dashed border-outline-variant text-primary font-label-md text-label-md flex items-center justify-center gap-2 cursor-pointer">
          <input type="file" accept="image/*,application/pdf" multiple className="hidden" disabled={busy !== null} onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
          <Icon name={busy === 'upload' ? 'progress_activity' : 'add_a_photo'} className={`text-[20px] ${busy === 'upload' ? 'animate-spin' : ''}`} />
          {busy === 'upload' ? t('ed_adding') : t('ed_add')}
        </label>
      </div>

      {msg && <p className={`font-body-sm text-body-sm ${msg.kind === 'ok' ? 'text-tertiary' : 'text-error'}`}>{msg.text}</p>}
      <button type="button" onClick={save} disabled={busy !== null} className="h-12 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg disabled:opacity-60">
        {busy === 'save' ? t('ed_saving') : t('ed_save')}
      </button>
    </div>
  );
}
