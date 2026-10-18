// Single-field editors shared by the sheet (plate / fields blocks) and the wizard.
import { useEffect, useRef, useState } from 'react';
import type { FieldDef } from '@/engine/schema';
import { getIn } from '@/engine/expr/eval';
import { useSystem } from '@/ui/context';
import { DotRow } from '@/ui/primitives';
import { cn } from '@/ui/lib/utils';
import { Markdown } from '@/ui/Markdown';
import { Combobox, type Option } from '@/ui/Combobox';
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
  if (!def) return null;
  const value = getIn(values, path.split('.'));
  const label = tr(`fields.${path}`);
  const input = cn(base, variant === 'plate' ? 'font-body text-[15px] font-medium' : 'text-sm');
  const wrap = 'flex flex-col gap-[3px] min-w-[100px]';
  const rawHelp = variant === 'form' ? tr(`help.${path}`) : '';
  const helpText = rawHelp && rawHelp !== path.split('.').pop() ? rawHelp : undefined;
  const helpEl = helpText ? <p className="text-xs text-text-mute leading-snug mt-1">{helpText}</p> : null;
  const desc = (catalog: string, id: string) => {
    const k = `desc.${catalog}.${id}`;
    const v = tr(k);
    return v === id ? undefined : v;
  };
  const cap = <span className={cn('font-body font-medium tracking-[0.1em] uppercase text-text-mute', variant === 'plate' ? 'text-[11px]' : 'text-[11px]')}>{label}</span>;

  switch (def.type) {
    case 'select': {
      const opts: Option[] = def.from
        ? pkg.model.catalogs[def.from].items.map((i) => ({ value: i.id, label: tr(`${def.from}.${i.id}`), desc: desc(def.from!, i.id) }))
        : (def.options ?? []).map((o) => ({ value: o, label: o }));
      return (
        <div className={wrap}>{cap}
          <Combobox value={String(value ?? '')} options={opts} disabled={readOnly} className={cn(input, 'font-body text-sm')} onChange={(v) => set(path, v)} />
          {helpEl}
        </div>
      );
    }
    case 'number':
      return (
        <label className={wrap}>{cap}
          <NumberInput className={input} value={Number(value ?? 0)} readOnly={readOnly} onChange={(n) => set(path, n)} />
          {helpEl}
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
      const field = (
        <input readOnly={readOnly} className={input} value={String(value ?? '')} onChange={(e) => set(path, e.target.value)} />
      );
      if (!def.suggest) return <label className={wrap}>{cap}{field}{helpEl}</label>;
      const opts: Option[] = pkg.model.catalogs[def.suggest].items.map((i) => ({ value: tr(`${def.suggest}.${i.id}`), label: tr(`${def.suggest}.${i.id}`), desc: desc(def.suggest!, i.id) }));
      return (
        <div className={wrap}>{cap}
          <Combobox value={String(value ?? '')} options={opts} allowCustom disabled={readOnly} className={cn(input, variant === 'plate' ? '' : 'font-body')} onChange={(v) => set(path, v)} />
          {helpEl}
        </div>
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

/** Free-typing number box: can be cleared while editing, no browser min/max validation. */
function NumberInput({ value, onChange, className, readOnly }: { value: number; onChange: (n: number) => void; className?: string; readOnly?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      readOnly={readOnly}
      className={className}
      inputMode="decimal"
      value={draft ?? String(value)}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        const n = Number(v.replace(',', '.'));
        if (v.trim() !== '' && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
