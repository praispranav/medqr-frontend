import { useEffect, useState, useCallback } from 'react';
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

let currentLang: LangCode = 'en';
const listeners = new Set<() => void>();

export function setLang(code: LangCode) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('medqr:lang', code);
  }
  currentLang = code;
  listeners.forEach((l) => l());
}

export function useT(fallbackClinicLang?: string) {
  const [lang, setLocalLang] = useState<LangCode>(currentLang);

  useEffect(() => {
    const handleUpdate = () => setLocalLang(currentLang);
    listeners.add(handleUpdate);
    
    // Initial sync
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('medqr:lang') as LangCode;
      const initial = saved || (fallbackClinicLang as LangCode) || 'en';
      if (initial !== currentLang) {
        currentLang = initial;
        handleUpdate();
      }
    }
    
    return () => {
      listeners.delete(handleUpdate);
    };
  }, [fallbackClinicLang]);

  useEffect(() => {
    if (lang !== 'en' && !dicts[lang]) {
      // Dynamic import
      import(`./${lang}.ts`).then((mod) => {
        dicts[lang] = mod.default || mod[lang];
        listeners.forEach((l) => l());
      }).catch(() => {
        // Fallback to empty if not found, en will be used
        dicts[lang] = {};
      });
    }
  }, [lang]);

  const t = useCallback((key: TranslationKey, vars?: Record<string, string | number>) => {
    const dict = dicts[lang] || {};
    let text = dict[key] || en[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  }, [lang]);

  return { t, lang, setLang };
}
