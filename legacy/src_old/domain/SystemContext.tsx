// Provides the active GameSystem to the component tree. The sheet/wizard/dice
// read everything from here — never from a concrete system import.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getSystem } from '@/systems';
import type { GameSystem } from '@/systems/types';
import { tr } from '@/i18n/lang';
import { useI18n } from '@/i18n/I18nContext';

interface SystemValue {
  system: GameSystem;
  /** Resolve a system label key in the current language. */
  label: (key: string) => string;
}

const SystemContext = createContext<SystemValue | null>(null);

export function SystemProvider({ systemId, children }: { systemId: string; children: ReactNode }) {
  const { lang } = useI18n();
  const value = useMemo<SystemValue>(() => {
    const system = getSystem(systemId);
    return { system, label: (key: string) => tr(system.labels, lang, key) };
  }, [systemId, lang]);

  return <SystemContext value={value}>{children}</SystemContext>;
}

export function useSystem(): SystemValue {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystem must be used within <SystemProvider>');
  return ctx;
}
