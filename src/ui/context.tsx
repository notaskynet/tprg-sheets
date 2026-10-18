// Binds the active system package to the UI: label lookup in the current language.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SystemPackage } from '@/engine/schema';
import { makeTranslate, type Translate } from '@/engine/labels';
import { createScope, type Scope } from '@/engine/expr/eval';
import { useI18n } from '@/i18n/I18nContext';
import { langDef } from '@/i18n/lang';

interface SystemValue {
  pkg: SystemPackage;
  /** System label by key (see engine/labels.ts for key conventions). */
  tr: Translate;
}

const Ctx = createContext<SystemValue | null>(null);

export function SystemProvider({ pkg, children }: { pkg: SystemPackage; children: ReactNode }) {
  const { lang } = useI18n();
  const value = useMemo<SystemValue>(
    () => ({ pkg, tr: makeTranslate(pkg, [lang, ...langDef(lang).fallback]) }),
    [pkg, lang],
  );
  return <Ctx value={value}>{children}</Ctx>;
}

export function useSystem(): SystemValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSystem must be used within <SystemProvider>');
  return v;
}

/** Expression scope for one character's values. */
export function useScope(values: Record<string, unknown>): Scope {
  const { pkg } = useSystem();
  return useMemo(() => createScope(pkg.model, values), [pkg, values]);
}
