// Language state + helpers, available app-wide. System and per-character system
// selection are layered on top via useSystem() (see domain/SystemContext).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LANG, isKnownLang, localize, tr, type Lang, type LocalizedText } from './lang';
import { UI } from './ui';

const LANG_KEY = 'trpg.lang';

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** App-chrome string by key. */
  t: (key: string) => string;
  /** Localized trait/clan/etc. name. */
  name: (text: LocalizedText | undefined) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && isKnownLang(saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key: string) => tr(UI, lang, key),
      name: (text) => localize(text, lang),
    }),
    [lang, setLang],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}
