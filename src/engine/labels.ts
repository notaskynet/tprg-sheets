// Label lookup for a system package. Keys follow the conventions in the package
// format: `<group|catalog>.<id>`, `<group>.title`, `<group>.cat.<cat>`,
// `fields.<path>`, `steps.<id>`, `hints.<id>`, `levels.<id>`, `damage.<kind>`.
import { getIn } from './expr/eval';
import type { SystemPackage } from './schema';

export type Translate = (key: string) => string;

/** `chain` is the language fallback order, e.g. ['ru', 'en']. Missing keys fall back to the id itself. */
export function makeTranslate(pkg: SystemPackage, chain: string[]): Translate {
  const order = [...chain, ...pkg.manifest.languages];
  return (key) => {
    for (const l of order) {
      const v = pkg.locales[l]?.[key];
      if (v != null) return v;
    }
    return key.slice(key.lastIndexOf('.') + 1);
  };
}

/** Human-readable value of a field: select ids become their catalog label. */
export function displayValue(pkg: SystemPackage, tr: Translate, path: string, values: Record<string, unknown>): string {
  const v = getIn(values, path.split('.'));
  if (v == null || v === '') return '';
  const f = pkg.model.fields[path];
  if (f?.type === 'select' && f.from) return tr(`${f.from}.${v}`);
  return String(v);
}
