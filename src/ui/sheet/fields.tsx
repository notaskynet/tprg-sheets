// Single-field editors shared by the sheet (plate / fields blocks) and the wizard.
import { useId } from 'react';
import type { FieldDef } from '@/engine/schema';
import { getIn } from '@/engine/expr/eval';
import { useSystem } from '@/ui/context';
import { DotRow } from '@/ui/primitives';
import { cn } from '@/ui/lib/utils';

const base = 'bg-transparent border-0 border-b border-line2 text-text py-0.5 outline-none focus:border-blood min-w-0 w-full';

export function FieldEditor({ path, values, set, variant = 'plate', readOnly }: {
  path: string;
  values: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
  variant?: 'plate' | 'form';
  readOnly?: boolean;
}) {
  const { pkg, tr } = useSystem();
  const def = pkg.model.fields[path] as FieldDef | undefined;
  const listId = useId();
  if (!def) return null;
  const value = getIn(values, path.split('.'));
  const label = tr(`fields.${path}`);
  const input = cn(base, variant === 'plate' ? 'font-display text-[17px] font-medium' : 'text-sm');
  const wrap = 'flex flex-col gap-[3px] min-w-[100px]';
  const cap = <span className={cn('font-mono tracking-[0.2em] uppercase text-text-mute', variant === 'plate' ? 'text-[9.5px]' : 'text-[10px]')}>{label}</span>;

  switch (def.type) {
    case 'select': {
      const opts = def.from ? pkg.model.catalogs[def.from].items.map((i) => ({ value: i.id, label: tr(`${def.from}.${i.id}`) })) : (def.options ?? []).map((o) => ({ value: o, label: o }));
      return (
        <label className={wrap}>{cap}
          <select disabled={readOnly} className={cn(input, 'field-select cursor-pointer font-body text-sm')} value={String(value ?? '')} onChange={(e) => set(path, e.target.value)}>
            <option value="">—</option>
            {opts.map((o) => <option key={o.value} value={o.value} className="bg-surf text-text">{o.label}</option>)}
          </select>
        </label>
      );
    }
    case 'number':
      return (
        <label className={wrap}>{cap}
          <input readOnly={readOnly} className={input} type="number" min={def.min} max={def.max} value={Number(value ?? 0)} onChange={(e) => set(path, Number(e.target.value))} />
        </label>
      );
    case 'longtext':
      return (
        <label className={wrap}>{cap}
          <textarea readOnly={readOnly} className="w-full min-h-40 bg-bg border border-line rounded text-text p-3 text-[13px] leading-relaxed outline-none resize-y focus:border-blood" value={String(value ?? '')} onChange={(e) => set(path, e.target.value)} />
        </label>
      );
    case 'dots':
      return <label className={wrap}>{cap}<DotRow value={Number(value ?? 0)} max={def.max} onChange={readOnly ? undefined : (n) => set(path, Math.max(def.min, n))} /></label>;
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={readOnly} checked={!!value} onChange={(e) => set(path, e.target.checked)} className="accent-blood" /> {label}
        </label>
      );
    case 'text': {
      const sug = def.suggest ? pkg.model.catalogs[def.suggest].items.map((i) => tr(`${def.suggest}.${i.id}`)) : [];
      return (
        <label className={wrap}>{cap}
          <input readOnly={readOnly} className={input} value={String(value ?? '')} list={sug.length ? listId : undefined} onChange={(e) => set(path, e.target.value)} />
          {sug.length > 0 && <datalist id={listId}>{sug.map((s) => <option key={s} value={s} />)}</datalist>}
        </label>
      );
    }
    default:
      return null; // list / damage-track / pool / checkboxes / percent have dedicated blocks
  }
}
