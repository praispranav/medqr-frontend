'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Icon } from '@/components/patient/ui';
import type { QrCodeView } from '@/lib/api';

// Printable QR standees (reception_counter_qr_standee_print_suite design), rebuilt as fixed-size
// artboards (1 mm = 3 px) so the header, headline and QR stay grouped tightly, and exported
// client-side as print-quality PNG (~300 dpi) or a PDF at the exact paper size.
// Posters deliberately use no icon font: exports stay small and look identical everywhere.

export type PosterKind = 'a5' | 'tent' | 'bw';

export const POSTER_FORMATS: { key: PosterKind; label: string; meta: string; mm: [number, number] }[] = [
  { key: 'a5', label: 'A5 counter & wall standee', meta: '148 × 210 mm', mm: [148, 210] },
  { key: 'tent', label: 'Table tent card', meta: '100 × 150 mm', mm: [100, 150] },
  { key: 'bw', label: 'Black & white — photocopier safe', meta: 'A5 · 148 × 210 mm', mm: [148, 210] },
];

const PX_PER_MM = 3;
const EXPORT_SCALE = 4; // ≈ 305 dpi

export interface PosterContent {
  url: string;
  /** Doctor or clinic name. Unassigned standees use a generic title. */
  title: string;
  subtitle?: string | null;
  /** Printed small at the bottom, e.g. "MQ-K7P3Q9" — what admin/doctor type to link it. */
  codeLabel?: string | null;
  footer: string;
  /** The three steps printed under the QR (default: Scan › Name & mobile › Get token). Keep each short. */
  steps?: string[];
  /** Big call to action (default: "Scan for your token" wording). */
  headline?: string;
  /** Small line under the headline. */
  tagline?: string;
}

export const patientBaseUrl = () =>
  (process.env.NEXT_PUBLIC_PATIENT_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

/**
 * Where admin-list standees point: the BACKEND's /q/<code>, which 302s each scan to the linked
 * doctor's clinic subdomain (or the app's "not set up yet" page). Printed codes never need reprinting.
 * NEXT_PUBLIC_QR_BASE_URL = the public backend address (e.g. https://api.medqr.in).
 */
export const qrBaseUrl = () =>
  (process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

/** Poster text for a standalone standee (/q/<code>): the doctor, the clinic (whole-clinic QR), or generic while unassigned. */
export function posterContentFor(q: QrCodeView): PosterContent {
  const base = qrBaseUrl();
  let host = base;
  try {
    host = new URL(base).host;
  } catch {
    /* keep */
  }
  return {
    url: `${base}/q/${q.code}`,
    title: q.doctor?.name ?? q.clinic?.name ?? 'MedQR Digital Queue',
    subtitle: q.doctor ? [q.doctor.specialty, q.clinic?.name].filter(Boolean).join(' · ') : q.clinic ? 'Live OPD digital queue' : 'Scan to check in with your doctor',
    footer: `${host}/q/${q.code}`,
    codeLabel: `MQ-${q.code}`,
  };
}

const STEPS = ['Scan', 'Name & mobile', 'Get token'];

function StepsRow({ color, muted, size, steps = STEPS }: { color: string; muted: string; size: number; steps?: string[] }) {
  return (
    <div className="flex items-center justify-center" style={{ gap: size * 0.6, fontSize: size, fontWeight: 700, color: muted, whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
      {steps.map((s, i) => (
        <span key={s} className="flex items-center" style={{ gap: size * 0.6, whiteSpace: 'nowrap' }}>
          <span className="flex items-center" style={{ gap: size * 0.35, whiteSpace: 'nowrap' }}>
            <span
              style={{ width: size * 1.6, height: size * 1.6, flexShrink: 0, borderRadius: 999, background: color, color: '#fff', fontSize: size * 0.85 }}
              className="flex items-center justify-center"
            >
              {i + 1}
            </span>
            {s}
          </span>
          {i < steps.length - 1 && <span style={{ color }}>›</span>}
        </span>
      ))}
    </div>
  );
}

const initialsOf = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'Q';

/** The artboard. Plain px sizes so the export matches the preview exactly. */
export const PosterArtboard = forwardRef<HTMLDivElement, { kind: PosterKind; content: PosterContent }>(function PosterArtboard(
  { kind, content },
  ref,
) {
  const f = POSTER_FORMATS.find((x) => x.key === kind)!;
  const [w, h] = [f.mm[0] * PX_PER_MM, f.mm[1] * PX_PER_MM];
  const base = { width: w, height: h, background: '#fff', fontFamily: 'Manrope, Inter, sans-serif' } as const;

  if (kind === 'bw') {
    return (
      <div ref={ref} style={{ ...base, color: '#000' }} className="flex items-center justify-center">
        <div style={{ width: w - 48, border: '3px solid #000', borderRadius: 18, overflow: 'hidden' }} className="flex flex-col items-center text-center">
          <div style={{ background: '#000', color: '#fff', width: '100%', padding: '18px 20px' }}>
            <p style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>{content.title}</p>
            {content.subtitle && <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{content.subtitle}</p>}
          </div>
          <p style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, marginTop: 20 }}>{(content.headline ?? 'Scan for your token').toUpperCase()}</p>
          <p style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{content.tagline ?? 'Any phone camera · no app needed'}</p>
          <div style={{ margin: '16px 0 10px' }}>
            <QRCodeSVG value={content.url} size={250} level="Q" marginSize={2} fgColor="#000000" bgColor="#ffffff" />
          </div>
          <StepsRow color="#000" muted="#000" size={14} steps={content.steps} />
          <p style={{ fontSize: 15, fontWeight: 700, margin: '10px 0 4px' }}>{content.footer}</p>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 16, letterSpacing: '0.08em' }}>{content.codeLabel ?? ' '}</p>
        </div>
      </div>
    );
  }

  if (kind === 'tent') {
    return (
      <div ref={ref} style={{ ...base, color: '#131b2e' }} className="flex flex-col items-center justify-center text-center">
        <p style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15, padding: '0 16px' }}>{content.title}</p>
        <p style={{ fontSize: 12, color: '#3e4947', marginTop: 3 }}>{content.subtitle || 'Live OPD digital queue'}</p>
        <p style={{ background: '#005c55', color: '#fff', fontSize: 15, fontWeight: 800, borderRadius: 10, padding: '8px 18px', marginTop: 12, letterSpacing: '0.04em' }}>
          {(content.headline ?? 'Scan to join queue').toUpperCase()}
        </p>
        <div style={{ margin: '12px 0 8px' }}>
          <QRCodeSVG value={content.url} size={190} level="M" marginSize={2} fgColor="#00201d" bgColor="#ffffff" />
        </div>
        <StepsRow color="#005c55" muted="#3e4947" size={11} steps={content.steps} />
        <p style={{ fontSize: 12, fontWeight: 700, color: '#005c55', marginTop: 8 }}>{content.footer}</p>
        {content.codeLabel && <p style={{ fontSize: 10, fontWeight: 700, color: '#3e4947', marginTop: 2, letterSpacing: '0.08em' }}>{content.codeLabel}</p>}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ ...base, color: '#131b2e' }} className="flex items-center justify-center">
      <div style={{ width: w - 48, border: '2px solid #cfe9e5', borderRadius: 22 }} className="flex flex-col items-center text-center overflow-hidden">
        <div style={{ width: '100%', background: '#f0fdfa', padding: '18px 22px' }} className="flex items-center gap-3 text-left">
          <div
            style={{ width: 52, height: 52, borderRadius: 999, background: '#0f766e', color: '#fff', fontSize: 20, fontWeight: 800, flexShrink: 0 }}
            className="flex items-center justify-center"
          >
            {initialsOf(content.title)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15 }}>{content.title}</p>
            <p style={{ fontSize: 13, color: '#3e4947', marginTop: 2 }}>{content.subtitle || 'Live OPD digital queue'}</p>
          </div>
        </div>
        <p style={{ fontSize: 30, fontWeight: 800, color: '#005c55', lineHeight: 1.1, marginTop: 20 }}>{content.headline ?? 'Scan for your OPD token'}</p>
        <p style={{ fontSize: 14, color: '#3e4947', marginTop: 6 }}>{content.tagline ?? 'Point your phone camera · see your live queue position'}</p>
        <div style={{ margin: '16px 0 10px', padding: 10, border: '1px solid #e2e7ff', borderRadius: 16 }}>
          <QRCodeSVG value={content.url} size={240} level="M" marginSize={2} fgColor="#00201d" bgColor="#ffffff" />
        </div>
        <StepsRow color="#005c55" muted="#3e4947" size={13} steps={content.steps} />
        <p style={{ fontSize: 13, fontWeight: 700, color: '#005c55', margin: '10px 0 2px' }}>{content.footer}</p>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#3e4947', marginBottom: 16, letterSpacing: '0.08em' }}>{content.codeLabel ?? ' '}</p>
      </div>
    </div>
  );
});

async function renderPng(node: HTMLElement) {
  const { toPng } = await import('html-to-image');
  return toPng(node, { pixelRatio: EXPORT_SCALE, cacheBust: true, backgroundColor: '#ffffff' });
}

function saveDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** One PDF, one poster per page — for a whole onboarding batch. */
export async function downloadPostersPdf(nodes: HTMLElement[], kind: PosterKind, filename: string) {
  const { jsPDF } = await import('jspdf');
  const [mw, mh] = POSTER_FORMATS.find((x) => x.key === kind)!.mm;
  const pdf = new jsPDF({ unit: 'mm', format: [mw, mh], orientation: 'portrait' });
  for (let i = 0; i < nodes.length; i++) {
    if (i > 0) pdf.addPage([mw, mh], 'portrait');
    pdf.addImage(await renderPng(nodes[i]), 'PNG', 0, 0, mw, mh);
  }
  pdf.save(filename);
}

/** Preview scaled to its column + Download PDF / PNG. */
export function PosterCard({
  kind,
  content,
  fileBase,
  showTitle = true,
}: {
  kind: PosterKind;
  content: PosterContent;
  fileBase: string;
  showTitle?: boolean;
}) {
  const f = POSTER_FORMATS.find((x) => x.key === kind)!;
  const [w, h] = [f.mm[0] * PX_PER_MM, f.mm[1] * PX_PER_MM];
  const posterRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => setScale(Math.min(1, (box.clientWidth - 32) / w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [w]);

  const download = async (type: 'pdf' | 'png') => {
    if (!posterRef.current) return;
    setBusy(type);
    setError(null);
    try {
      if (type === 'png') saveDataUrl(await renderPng(posterRef.current), `${fileBase}-${kind}.png`);
      else await downloadPostersPdf([posterRef.current], kind, `${fileBase}-${kind}.pdf`);
    } catch (e) {
      setError(`Couldn't create the file: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {showTitle && (
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-label-lg text-label-lg text-on-surface">{f.label}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">{f.meta}</p>
        </div>
      )}
      <div ref={boxRef} className="bg-surface-container-low rounded-2xl p-4 flex justify-center">
        <div style={{ width: w * scale, height: h * scale }} className="shadow-md">
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: w, height: h }}>
            {content.url && <PosterArtboard ref={posterRef} kind={kind} content={content} />}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={!!busy || !content.url}
          onClick={() => download('pdf')}
          className="h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Icon name={busy === 'pdf' ? 'progress_activity' : 'picture_as_pdf'} className={`text-[18px] ${busy === 'pdf' ? 'animate-spin' : ''}`} />
          Download PDF
        </button>
        <button
          disabled={!!busy || !content.url}
          onClick={() => download('png')}
          className="h-11 rounded-xl bg-surface-container-lowest text-primary font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
        >
          <Icon name={busy === 'png' ? 'progress_activity' : 'image'} className={`text-[18px] ${busy === 'png' ? 'animate-spin' : ''}`} />
          Download PNG
        </button>
      </div>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </div>
  );
}
