import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { en, type TranslationKey } from './en';

/**
 * Decision 34: flip to true once the language files (hi.ts, mr.ts, …) actually contain translations
 * and every patient screen uses t(). Until then the 🌐 switcher and the clinic "Patient language"
 * setting stay hidden — an option that changes nothing is worse than no option.
 */
export const PATIENT_LANGUAGES_READY = true;

export type LangCode = 'en' | 'hi' | 'mr' | 'te' | 'ml' | 'ta' | 'kn' | 'bn' | 'gu';

const dicts: Partial<Record<LangCode, Partial<Record<TranslationKey, string>>>> = {
  en,
};

export const LANG_NAMES: Record<LangCode, string> = {
  en: 'English',
  hi: 'हिन्दी',
  mr: 'मराठी',
  te: 'తెలుగు',
  ml: 'മലയാളം',
  ta: 'தமிழ்',
  kn: 'ಕನ್ನಡ',
  bn: 'বাংলা',
  gu: 'ગુજરાતી',
};

// Shared language store (Decisions 34–35). Effective language = the patient's own 🌐 choice
// (localStorage, per phone) → else the page's default (the doctor's language on their intake /
// token page, the clinic's elsewhere) → else English. Only pages that pass a default to useT() set
// it; components calling useT() with no argument just follow. `version` also bumps when a
// language file finishes loading, so every component re-renders with the new words.
const STORAGE_KEY = 'medqr:lang';
const isLang = (v: unknown): v is LangCode => typeof v === 'string' && v in LANG_NAMES;
let pageDefault: LangCode = 'en';
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

function userChoice(): LangCode | null {
  try {
    const v = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

function effectiveLang(): LangCode {
  return userChoice() ?? pageDefault;
}

function ensureLoaded(lang: LangCode) {
  if (dicts[lang]) return;
  dicts[lang] = {}; // mark as loading; English shows until it arrives
  import(`./${lang}.ts`)
    .then((mod) => {
      dicts[lang] = mod.default || mod[lang] || {};
      emit();
    })
    .catch(() => undefined);
}

/** The patient picked a language with 🌐 — remembered on this phone. */
export function setLang(code: LangCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode: just this visit */
  }
  ensureLoaded(code);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => `${effectiveLang()}:${version}`;
const serverSnapshot = () => 'en:0';

/**
 * `pageDefault` = the doctor's (intake / token page) or the clinic's language for this page.
 * Leave it out in shared components — they follow whatever the page set.
 */
export function useT(pageDefaultLang?: string) {
  // From the snapshot (English during server render / hydration, then the real one) — no mismatch.
  const lang = useSyncExternalStore(subscribe, snapshot, serverSnapshot).split(':')[0] as LangCode;

  useEffect(() => {
    if (!isLang(pageDefaultLang) || pageDefaultLang === pageDefault) return;
    pageDefault = pageDefaultLang;
    emit();
  }, [pageDefaultLang]);

  useEffect(() => {
    if (lang !== 'en') ensureLoaded(lang);
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text: string = dicts[lang]?.[key] || en[key] || key;
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
      return text;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, version],
  );

  return { t, lang, setLang };
}

/** Locale for dates in the patient's language ("बुध, 8 अक्टू"). */
export function dateLocale(lang: LangCode) {
  return `${lang}-IN`;
}

type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/**
 * The server describes a doctor's day in English ("From 5:00 PM", "Resumes at 1:00 PM", …,
 * see backend doctors/shift-state.ts). Rebuild those sentences in the patient's language; anything
 * unrecognised is shown as sent.
 */
export function localizeStatusDetail(detail: string | null | undefined, t: TFn): string {
  if (!detail) return '';
  let m: RegExpMatchArray | null;
  if ((m = detail.match(/^From (.+)$/))) return t('st_from', { time: m[1] });
  if ((m = detail.match(/^Resumes at (.+)$/))) return t('st_resumes', { time: m[1] });
  if ((m = detail.match(/^Running late — starting by (.+)$/))) return t('st_running_late', { time: m[1] });
  if (detail === 'Consulting now') return t('st_consulting_now');
  if (detail === 'Not consulting today') return t('st_not_today');
  if (detail === 'Sessions ended for today') return t('st_sessions_ended');
  if (detail === 'Starting soon') return t('st_starting_soon');
  if (detail === 'Done for today') return t('st_done_today');
  if (detail === 'Back shortly') return t('st_back_shortly');
  return detail;
}
