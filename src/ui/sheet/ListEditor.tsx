// Editor for `list` fields: named rows with dots / number / note, optional catalog quick-picks.
import { useState } from 'react';
import { X } from 'lucide-react';
import { getIn } from '@/engine/expr/eval';
import type { FieldDef } from '@/engine/schema';
import { useScope, useSystem } from '@/ui/context';
import { useI18n } from '@/i18n/I18nContext';
import { DotRow } from '@/ui/primitives';

export interface Row { id: string; name: string; level: number; note?: string; ref?: string }

export function ListEditor({ path, def, values, set, scopeExpr, readOnly }: {
  path: string;
  def: Extract<FieldDef, { type: 'list' }>;
  values: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
  scopeExpr?: string; // expression yielding catalog ids to offer first
  readOnly?: boolean;
}) {
  const { pkg, tr } = useSystem();
  const { t } = useI18n();
  const scope = useScope(values);
  const [picker, setPicker] = useState(false);
  const rows = (getIn(values, path.split('.')) ?? []) as Row[];
  const catalog = def.suggest;
  const nameOf = (r: Row) => (r.ref && catalog ? tr(`${catalog}.${r.ref}`) : r.name);

  let offered: string[] = [];
  if (catalog) {
    const scoped = scopeExpr ? scope.run(scopeExpr) : undefined;
    offered = Array.isArray(scoped) && scoped.length ? (scoped as string[]) : pkg.model.catalogs[catalog].items.map((i) => i.id);
    offered = offered.filter((id) => !rows.some((r) => r.ref === id));
  }

  const update = (i: number, patch: Partial<Row>) => set(path, rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = (row: Partial<Row>) => { set(path, [...rows, { id: crypto.randomUUID(), name: '', level: def.item === 'dots' ? 1 : 0, ...row }]); setPicker(false); };

  return (
    <div>
      {rows.length === 0 && <div className="text-text-dim text-xs py-1.5">—</div>}
      {rows.map((r, i) => (
        <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 py-[5px] border-b border-dashed border-line last:border-0 group">
          <div className="flex items-center gap-1.5 text-[13px] min-w-0">
            <input
              readOnly={readOnly}
              value={nameOf(r)}
              placeholder="—"
              onChange={(e) => update(i, { name: e.target.value, ref: undefined })}
              className="bg-transparent border-0 p-0 flex-1 min-w-0 outline-none focus:text-brand-bright"
            />
            {def.item === 'note' && (
              <input readOnly={readOnly} value={r.note ?? ''} placeholder="…" onChange={(e) => update(i, { note: e.target.value })} className="bg-transparent border-0 p-0 w-1/3 min-w-0 outline-none text-text-mute text-xs italic focus:text-text" />
            )}
            {!readOnly && (
              <button type="button" onClick={() => set(path, rows.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-brand-bright p-1 transition-opacity" aria-label="remove"><X className="size-3" /></button>
            )}
          </div>
          {def.item === 'dots' && <DotRow value={r.level} max={def.max} onChange={readOnly ? undefined : (n) => update(i, { level: n })} />}
          {def.item === 'number' && <input type="number" value={r.level} readOnly={readOnly} onChange={(e) => update(i, { level: Number(e.target.value) })} className="w-12 bg-transparent border-b border-line2 text-right font-mono text-sm outline-none" />}
        </div>
      ))}
      {!readOnly && (
        <div className="pt-2.5 print:hidden">
          {picker ? (
            <div className="flex flex-wrap gap-1.5">
              {offered.map((id) => (
                <button key={id} onClick={() => add({ ref: id })} className="border border-line2 text-text-mute px-2.5 py-1 rounded-sm text-xs hover:text-text hover:border-text-mute transition-colors">{tr(`${catalog}.${id}`)}</button>
              ))}
              <button onClick={() => add({})} className="border border-line2 text-text-mute px-2.5 py-1 rounded-sm text-xs">{t('custom')}</button>
              <button onClick={() => setPicker(false)} className="text-text-dim px-1.5 py-1 text-xs" aria-label="close">×</button>
            </div>
          ) : (
            <button onClick={() => (catalog ? setPicker(true) : add({}))} className="text-text-dim text-xs py-1 hover:text-text transition-colors">+ {t('addItem').toLowerCase()}</button>
          )}
        </div>
      )}
    </div>
  );
}
