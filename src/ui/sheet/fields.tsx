// Single-field editors shared by the sheet (plate / fields blocks) and the wizard.
import { useEffect, useId, useRef, useState } from 'react';
import type { FieldDef } from '@/engine/schema';
import { getIn } from '@/engine/expr/eval';
import { useSystem } from '@/ui/context';
import { DotRow } from '@/ui/primitives';
import { cn } from '@/ui/lib/utils';
import { Markdown } from '@/ui/Markdown';
import { useI18n } from '@/i18n/I18nContext';

const base = 'bg-transparent border-0 border-b border-line2 text-text py-0.5 outline-none focus:border-brand min-w-0 w-full';

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
  const input = cn(base, variant === 'plate' ? 'font-body text-[15px] font-medium' : 'text-sm');
  const wrap = 'flex flex-col gap-[3px] min-w-[100px]';
  const cap = <span className={cn('font-body font-medium tracking-[0.1em] uppercase text-text-mute', variant === 'plate' ? 'text-[11px]' : 'text-[11px]')}>{label}</span>;

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
        <div className={wrap}>
          {cap}
          <MarkdownField value={String(value ?? '')} onChange={(v) => set(path, v)} readOnly={readOnly} />
        </div>
      );
    case 'dots':
      return <label className={wrap}>{cap}<DotRow value={Number(value ?? 0)} max={def.max} onChange={readOnly ? undefined : (n) => set(path, Math.max(def.min, n))} /></label>;
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={readOnly} checked={!!value} onChange={(e) => set(path, e.target.checked)} className="accent-brand" /> {label}
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

/** Rendered markdown until focused; click (or tap) to edit, blur to render again. */
function MarkdownField({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) ta.current?.focus(); }, [editing]);

  const box = 'w-full min-h-40 bg-bg border border-line rounded p-3 text-[13px] leading-relaxed';
  if (editing && !readOnly) {
    return (
      <textarea
        ref={ta}
        className={cn(box, 'outline-none resize-y focus:border-brand font-mono print:hidden')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        placeholder={t('notesPlaceholder')}
      />
    );
  }
  return (
    <div
      role={readOnly ? undefined : 'button'}
      tabIndex={readOnly ? undefined : 0}
      onClick={() => !readOnly && setEditing(true)}
      onKeyDown={(e) => { if (!readOnly && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setEditing(true); } }}
      className={cn(box, !readOnly && 'cursor-text hover:border-line2 focus-visible:border-brand outline-none')}
    >
      {value.trim() ? <Markdown source={value} onChange={readOnly ? undefined : onChange} /> : <span className="text-text-dim italic">{t('notesPlaceholder')}</span>}
    </div>
  );
}
