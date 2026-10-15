'use client';

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Icon } from '@/components/patient/ui';
import { fileUrl, type QrCodeView } from '@/lib/api';

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
  /** Printed small at the bottom, e.g. "MQ-K7P3Q9" — what admin/doctor type to link it. Never the raw link itself. */
  codeLabel?: string | null;
  /** The three steps printed under the QR (default: Scan › Name & mobile › Get token). Keep each short. */
  steps?: string[];
  /** Big call to action (default: "Scan for your token" wording). */
  headline?: string;
  /** Small line under the headline. */
  tagline?: string;
  /** Small pill under the name, e.g. "Cabin 3" or "Front desk". */
  cabinLabel?: string | null;
  /** Second small pill, under the main hero card — e.g. "Live OPD queue". */
  roleBadge?: string;
  /** Printed small at the very bottom as a typed-URL fallback if the camera won't scan. */
  fallbackDomain?: string | null;
  /** Doctor's own photo — shown instead of the initials circle when set. */
  photoUrl?: string | null;
}

export const patientBaseUrl = () =>
  (process.env.NEXT_PUBLIC_PATIENT_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

/**
 * Where admin-list standees point: THIS APP's own /q/<code> page, which calls GET /qr/:code and
 * decides client-side where to go (the linked doctor's check-in, the clinic's doctor selection, or
 * an explainer for not-set-up-yet / disabled / off-today) — never a server-side redirect. This keeps
 * the target domain-correct automatically (whichever frontend build printed the code is the one the
 * patient lands on) even once a second production domain goes live against the same shared API, and
 * lets the page show a proper error UI instead of a bare redirect. Printed codes never need reprinting.
 */
export function posterContentFor(q: QrCodeView): PosterContent {
  const base = patientBaseUrl();
  return {
    url: `${base}/q/${q.code}`,
    title: q.doctor?.name ?? q.clinic?.name ?? 'Digital Queue',
    subtitle: q.doctor ? [q.doctor.specialty, q.clinic?.name].filter(Boolean).join(' · ') : q.clinic ? 'Live OPD digital queue' : 'Scan to check in with your doctor',
    codeLabel: `MQ-${q.code}`,
    cabinLabel: q.doctor?.cabin_label ?? null,
    roleBadge: q.doctor ? 'OPD Desk · Live Queue Check-In' : 'Live OPD Digital Queue',
    fallbackDomain: base.replace(/^https?:\/\//, ''),
    photoUrl: q.doctor?.photo_url ? fileUrl(q.doctor.photo_url) : null,
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
  const base = { width: w, height: h, background: '#fff', fontFamily: 'Manrope, Inter, sans-serif', overflow: 'hidden' } as const;

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
          <p style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 4px', letterSpacing: '0.08em' }}>{content.codeLabel ?? ' '}</p>
          <p style={{ fontSize: 9, fontWeight: 700, margin: '0 0 14px', letterSpacing: '0.1em' }}>ClinicQ</p>
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
        {content.codeLabel && <p style={{ fontSize: 10, fontWeight: 700, color: '#3e4947', marginTop: 8, letterSpacing: '0.08em' }}>{content.codeLabel}</p>}
        <p style={{ fontSize: 8, fontWeight: 700, color: '#8a938f', marginTop: 4, marginBottom: 10, letterSpacing: '0.1em' }}>ClinicQ</p>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ ...base, color: '#131b2e' }}>
      <FitToHeight maxH={h - 4}>
      <div style={{ width: w - 24, border: '2px solid #cfe9e5', borderRadius: 22 }} className="flex flex-col items-center text-center overflow-hidden">
        <div style={{ width: '100%', background: '#f0fdfa', padding: '20px 22px' }} className="flex items-center gap-3 text-left">
          {content.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.photoUrl}
              alt=""
              style={{ width: 68, height: 68, borderRadius: 999, objectFit: 'cover', flexShrink: 0, border: '2px solid #fff', boxShadow: '0 0 0 2px #cfe9e5' }}
            />
          ) : (
            <div
              style={{ width: 68, height: 68, borderRadius: 999, background: '#0f766e', color: '#fff', fontSize: 24, fontWeight: 800, flexShrink: 0 }}
              className="flex items-center justify-center"
            >
              {initialsOf(content.title)}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15 }}>{content.title}</p>
            <p style={{ fontSize: 13, color: '#3e4947', marginTop: 2 }}>{content.subtitle || 'Live OPD digital queue'}</p>
          </div>
          {content.cabinLabel && (
            <span
              style={{
                flexShrink: 0, padding: '4px 10px', borderRadius: 999, background: '#ffffff', border: '1px solid #cfe9e5',
                fontSize: 11, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase',
              }}
            >
              {content.cabinLabel}
            </span>
          )}
        </div>
        <p style={{ fontSize: 30, fontWeight: 800, color: '#005c55', lineHeight: 1.1, marginTop: 20 }}>{content.headline ?? 'Scan for your OPD token'}</p>
        <p style={{ fontSize: 14, color: '#3e4947', marginTop: 6 }}>{content.tagline ?? 'Point your phone camera · see your live queue position'}</p>
        {/* Plain QR, no border box around it — just a small checkmark mark at its center. */}
        <div style={{ position: 'relative', margin: '16px 0 10px' }}>
          <QRCodeSVG value={content.url} size={240} level="H" marginSize={2} fgColor="#00201d" bgColor="#ffffff" />
          <div
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 30, height: 30, borderRadius: 8, background: '#0f766e', border: '3px solid #fff',
            }}
            className="flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M3 10.5L8 15.5L17 5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <StepsRow color="#005c55" muted="#3e4947" size={13} steps={content.steps} />
        <p style={{ fontSize: 11, fontWeight: 700, color: '#3e4947', margin: '10px 0 4px', letterSpacing: '0.08em' }}>{content.codeLabel ?? ' '}</p>
        <p style={{ fontSize: 9, fontWeight: 700, color: '#8a938f', margin: '0 0 14px', letterSpacing: '0.1em' }}>ClinicQ</p>
      </div>
      </FitToHeight>
    </div>
  );
});

/**
 * Keeps a poster card inside its artboard: when the content (long names, the "camera not working" line, the brand line) is
 * taller than the paper, it is scaled down to fit instead of spilling over the page — in the preview and in the PDF / PNG.
 */
function FitToHeight({ maxH, children }: { maxH: number; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const fit = () => setScale(el.offsetHeight > maxH ? maxH / el.offsetHeight : 1);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxH]);
  return (
    <div style={{ height: maxH + 12, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  );
}

export const PNG_SIZES = [
  { key: 'web', label: 'Web / WhatsApp (72 dpi)', pixelRatio: 1 },
  { key: 'standard', label: 'Standard print (150 dpi)', pixelRatio: 2 },
  { key: 'print', label: 'High-quality print (300 dpi)', pixelRatio: 4 },
] as const;
export type PngSizeKey = (typeof PNG_SIZES)[number]['key'];

async function renderPng(node: HTMLElement, pixelRatio: number = EXPORT_SCALE) {
  const { toPng } = await import('html-to-image');
  return toPng(node, { pixelRatio, cacheBust: true, backgroundColor: '#ffffff' });
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
  const [pngSize, setPngSize] = useState<PngSizeKey>('print');

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
      if (type === 'png') {
        const ratio = PNG_SIZES.find((s) => s.key === pngSize)!.pixelRatio;
        saveDataUrl(await renderPng(posterRef.current, ratio), `${fileBase}-${kind}.png`);
      } else await downloadPostersPdf([posterRef.current], kind, `${fileBase}-${kind}.pdf`);
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
      <label className="flex items-center gap-2 -mt-1">
        <span className="font-body-sm text-body-sm text-on-surface-variant shrink-0">PNG size</span>
        <select
          value={pngSize}
          onChange={(e) => setPngSize(e.target.value as PngSizeKey)}
          className="flex-1 h-9 rounded-lg bg-surface-container-low px-2 font-body-sm text-body-sm focus:outline-none"
        >
          {PNG_SIZES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
    </div>
  );
}
