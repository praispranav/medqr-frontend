'use client';
import Link from "next/link";
import { useState } from 'react';
import { useT, LANG_NAMES, type LangCode } from '@/lib/i18n';

import type { DoctorToday, DoctorTodayStatus, NextSession } from '@/lib/api';

/** Material Symbols glyph, as used throughout the Stitch exports. */
export function Icon({ name, className = '', fill = false }: { name: string; className?: string; fill?: boolean }) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

export function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function DoctorAvatar({
  doctor,
  size = 'w-14 h-14',
  muted = false,
}: {
  doctor: Pick<DoctorToday, 'name' | 'photo_url'>;
  size?: string;
  muted?: boolean;
}) {
  if (doctor.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={doctor.name} src={doctor.photo_url} className={`${size} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center font-headline-sm text-headline-sm font-bold flex-shrink-0 ${
        muted ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary-fixed text-primary'
      }`}
    >
      {initials(doctor.name)}
    </div>
  );
}

/** The per-doctor status strip from Screen #1A — one look per today-only state (Decision 6). */
/** "Mon 6 Oct, 5:00 PM" for an off-today doctor's next session (Decision 6, amended: information only). */
export function nextSessionLabel(n: NextSession) {
  const day = new Date(`${n.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const [h, m] = n.starts_at.split(':').map(Number);
  return `${day}, ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function DoctorStatusRow({ status, detail, next }: { status: DoctorTodayStatus; detail: string; next?: NextSession | null }) {
  switch (status) {
    case 'available':
      return (
        <div className="mt-1 flex items-center justify-between bg-surface-container-low px-3 py-1.5 rounded-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-tertiary" />
            <span className="font-label-sm text-label-sm text-on-surface font-semibold">Available</span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">{detail}</span>
        </div>
      );
    case 'on_break':
      return (
        <div className="mt-1 flex items-center justify-between bg-secondary-fixed/30 px-3 py-1.5 rounded-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="font-label-sm text-label-sm text-secondary font-bold">On break</span>
          </div>
          <span className="font-label-sm text-label-sm text-secondary font-medium">{detail}</span>
        </div>
      );
    case 'starts_later_today':
      return (
        <div className="mt-1 flex items-center justify-between bg-surface-container-low px-3 py-1.5 rounded-lg">
          <div className="flex items-center gap-1.5">
            <Icon name="schedule" className="text-[16px] text-primary" />
            <span className="font-label-sm text-label-sm text-primary font-bold">Starts later today</span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">{detail}</span>
        </div>
      );
    case 'off_today':
      return (
        <div className="mt-1 flex items-center justify-between bg-surface-container px-3 py-1.5 rounded-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-error" />
            <span className="font-label-sm text-label-sm text-error font-bold">Off today</span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">{next ? `Next: ${nextSessionLabel(next)}` : detail}</span>
        </div>
      );
  }
}

/** Fixed app bar shared by the patient screens (Screens #1A, #3). */
export function PatientHeader({ eyebrow, title, onBack, homeUrl }: { eyebrow: string; title: string; onBack?: () => void; homeUrl?: string }) {
  const [langOpen, setLangOpen] = useState(false);
  const { lang, setLang } = useT();

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-16 px-margin flex items-center justify-between gap-space-sm max-w-[480px] mx-auto w-full">
        <div className="flex items-center gap-space-sm flex-1 min-w-0">
          {onBack && (
            <button
              aria-label="Go back"
              onClick={onBack}
              className="relative z-10 w-12 h-12 -ml-2 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface active:bg-surface-container transition-colors shrink-0 touch-manipulation"
            >
              <Icon name="arrow_back" className="text-[24px]" />
            </button>
          )}
          <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center flex-shrink-0">
            <Icon name="qr_code_2" className="text-[22px]" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-primary font-bold tracking-tight uppercase truncate">{eyebrow}</span>
            <span className="font-headline-sm text-headline-sm text-on-surface truncate">{title}</span>
          </div>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => setLangOpen(true)}
            className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface active:bg-surface-container transition-colors shrink-0 touch-manipulation"
            aria-label="Change language"
          >
            <Icon name="language" className="text-[24px]" />
          </button>
          {homeUrl && (
            <Link
              href={homeUrl}
              className="relative z-10 w-12 h-12 -mr-2 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface active:bg-surface-container transition-colors shrink-0 touch-manipulation"
              aria-label="Home"
            >
              <Icon name="home" className="text-[24px]" />
            </Link>
          )}
        </div>
      </div>
      {langOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setLangOpen(false)}>
          <div className="w-full max-w-[480px] bg-surface rounded-t-3xl p-6 pb-safe flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Change language</h3>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(LANG_NAMES) as [LangCode, string][]).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => { setLang(code); setLangOpen(false); }}
                  className={`h-12 rounded-xl font-label-md text-label-md border flex items-center justify-center ${
                    lang === code ? 'border-primary bg-primary-fixed/30 text-primary' : 'border-surface-container text-on-surface-variant bg-surface'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function FullPageMessage({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-3 bg-surface">
      <div className="w-14 h-14 rounded-full bg-surface-container-low text-primary flex items-center justify-center">
        <Icon name={icon} className="text-[28px]" />
      </div>
      <h1 className="font-headline-md text-headline-md text-on-surface">{title}</h1>
      {body && <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">{body}</p>}
    </main>
  );
}

export function LoadingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface">
      <Icon name="progress_activity" className="text-[32px] text-primary animate-spin" />
    </main>
  );
}
