// Everything a character summary card shows, resolved from the system package.
import { evaluateCreation } from '@/engine/creation';
import { createScope } from '@/engine/expr/eval';
import { displayValue, makeTranslate } from '@/engine/labels';
import type { Character } from '@/engine/character';
import type { SystemPackage } from '@/engine/schema';
import { langDef } from '@/i18n/lang';

export interface CardData {
  title: string;
  subtitle: string[];
  campaign: string;
  stats: { label: string; value: number | string; brand: boolean }[];
  valid: boolean;
}

export function cardData(pkg: SystemPackage, ch: Character, lang: string): CardData {
  const tr = makeTranslate(pkg, [lang, ...langDef(lang).fallback]);
  const summary = pkg.manifest.summary;
  const scope = createScope(pkg.model, ch.values);
  return {
    title: summary ? displayValue(pkg, tr, summary.title, ch.values) : '',
    subtitle: (summary?.subtitle ?? []).map((p) => displayValue(pkg, tr, p, ch.values)).filter(Boolean),
    campaign: summary?.campaign ? displayValue(pkg, tr, summary.campaign, ch.values) : '',
    valid: evaluateCreation(pkg, ch, scope).checklist.every((c) => c.ok),
    stats: (summary?.stats ?? []).map((k) => {
      const v = scope.get([k]);
      const label = pkg.model.derived[k] != null ? tr(`derived.${k}`) : tr(`fields.${k}`);
      return { label, value: typeof v === 'number' ? v : '—', brand: pkg.model.fields[k]?.type === 'pool' };
    }),
  };
}
