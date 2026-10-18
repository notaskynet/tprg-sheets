// Step bodies, one per creation step kind. Budgets, validity and labels all come
// from the system package; nothing here knows about a concrete game.
import type { ReactNode } from 'react';
import type { CreationStep } from '@/engine/schema';
import { groupItems } from '@/engine/schema';
import type { CreationReport, StepStatus } from '@/engine/creation';
import { getIn } from '@/engine/expr/eval';
import { displayValue } from '@/engine/labels';
import { useI18n } from '@/i18n/I18nContext';
import { useScope, useSystem } from '@/ui/context';
import { Dot, DotRow } from '@/ui/primitives';
import { FieldEditor } from '@/ui/sheet/fields';
import { ListEditor } from '@/ui/sheet/ListEditor';
import { cn } from '@/ui/lib/utils';
import { reasonOf } from '@/ui/reason';
import { rollNotation } from '@/engine/dice/notation';
import { NumberInput } from '@/ui/sheet/fields';

export interface StepProps<K extends CreationStep['kind'] = CreationStep['kind']> {
  step: Extract<CreationStep, { kind: K }>;
  status: StepStatus;
  report: CreationReport;
  values: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
  onGoto: (stepId: string) => void;
  onMethod: (stepId: string, method: string) => void;
  method?: string;
}

export function StepBody(p: StepProps) {
  switch (p.step.kind) {
    case 'fields': return <FieldsStep {...(p as StepProps<'fields'>)} />;
    case 'pick': return <PickStep {...(p as StepProps<'pick'>)} />;
    case 'priority': return <PriorityStep {...(p as StepProps<'priority'>)} />;
    case 'list': return <ListStep {...(p as StepProps<'list'>)} />;
    case 'freebies': return <FreebiesStep {...(p as StepProps<'freebies'>)} />;
    case 'scores': return <ScoresStep {...(p as StepProps<'scores'>)} />;
    case 'spend': return <SpendStep {...(p as StepProps<'spend'>)} />;
    case 'recap': return <RecapStep {...(p as StepProps<'recap'>)} />;
    // list of kinds is closed (see CreationStep); a new kind must get a body here
  }
}

// ---------- building blocks ----------

function Stat({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('p-4 bg-surf border border-line rounded-md', className)}>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="font-display text-[28px] leading-none">{children}</div>
    </div>
  );
}

function ShownStats({ names, values }: { names: string[]; values: Record<string, unknown> }) {
  const { tr } = useSystem();
  const scope = useScope(values);
  if (!names.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {names.map((n) => <Stat key={n} label={tr(`derived.${n}`)}>{String(scope.get([n]) ?? '—')}</Stat>)}
    </div>
  );
}

// ---------- steps ----------

function FieldsStep({ step, values, set }: StepProps<'fields'>) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[22px] gap-y-4">
      {step.fields.map((f) => <FieldEditor key={f} path={f} variant="form" values={values} set={set} />)}
    </div>
  );
}

function PickStep({ step, values, set }: StepProps<'pick'>) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[22px] gap-y-4">
        <FieldEditor path={step.field} variant="form" values={values} set={set} />
        {step.fields.map((f) => <FieldEditor key={f} path={f} variant="form" values={values} set={set} />)}
      </div>
      <ShownStats names={step.show} values={values} />
    </div>
  );
}

function PriorityStep({ step, status, values, set }: StepProps<'priority'>) {
  const { pkg, tr } = useSystem();
  const group = pkg.model.groups[step.group];
  const field = group.field as { type: string; min?: number; max?: number };
  const items = groupItems(pkg.model, step.group);
  const cats: (string | null)[] = group.categories.length ? group.categories : [null];
  const budgets = step.budgets;
  const maxBudget = Math.max(...budgets);
  const max = field.max ?? 5;

  return (
    <div className="flex flex-col gap-6">
      <div className={cn('grid grid-cols-1 gap-7 items-start', cats.length > 1 ? 'md:grid-cols-3' : 'max-w-md')}>
        {cats.map((cat) => {
          const its = items.filter((i) => !cat || i.cat === cat);
          const spent = its.reduce((s, i) => s + Number(getIn(values, [step.group, i.id]) ?? step.base) - step.base, 0);
          const tone = budgets.includes(spent) ? 'text-good' : spent > maxBudget ? 'text-brand-bright' : 'text-text-mute';
          return (
            <div key={cat ?? 'all'}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="eyebrow">{cat ? tr(`${step.group}.cat.${cat}`) : tr(`${step.group}.title`)}</span>
                <span className={cn('font-mono text-xs', tone)}>{spent}</span>
              </div>
              {its.map((it) => (
                <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 py-[5px] border-b border-dashed border-line last:border-0">
                  <span className="text-[13px]">{tr(`${step.group}.${it.id}`)}</span>
                  <DotRow
                    value={Number(getIn(values, [step.group, it.id]) ?? step.base)}
                    max={max}
                    dimFrom={step.maxPerItem}
                    onChange={(n) => set(`${step.group}.${it.id}`, Math.max(step.base, n))}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {status.capViolations && status.capViolations.length > 0 && (
        <p className="text-xs text-gold">{status.capViolations.map((id) => tr(`${step.group}.${id}`)).join(', ')} &gt; {step.maxPerItem}</p>
      )}
      <ShownStats names={step.show} values={values} />
    </div>
  );
}

function ListStep({ step, status, values, set }: StepProps<'list'>) {
  const { pkg } = useSystem();
  const { t } = useI18n();
  const def = pkg.model.fields[step.field];
  if (def?.type !== 'list') return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="font-mono text-[11px] text-text-mute">{t('spent')} {(status.spent ?? 0) + (status.overflow ?? 0)} / {step.budget}</div>
      <ListEditor path={step.field} def={def} values={values} set={set} scopeExpr={step.scope} />
      <ShownStats names={step.show} values={values} />
    </div>
  );
}

function FreebiesStep({ step, status, report, values, set }: StepProps<'freebies'>) {
  const { tr } = useSystem();
  const { t } = useI18n();
  const spent = status.spent ?? 0;
  const left = step.budget - spent;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-text-mute text-sm">{t('goBackToSpend')}</p>
      <div className="p-4 bg-surf border border-line rounded-md flex items-end gap-8">
        <div>
          <div className="eyebrow">{t('spent')}</div>
          <div className="font-display text-[28px] leading-none mt-1"><span className={spent > step.budget ? 'text-brand-bright' : ''}>{spent}</span><span className="text-text-mute text-sm font-mono"> / {step.budget}</span></div>
        </div>
        <div>
          <div className="eyebrow">{t('remaining')}</div>
          <div className={cn('font-display text-[28px] leading-none mt-1', left < 0 && 'text-brand-bright')}>{left}</div>
        </div>
      </div>
      <div className="flex flex-col">
        {step.costs.map((rule, i) => {
          if ('step' in rule) {
            const over = report.steps.find((s) => s.id === rule.step)?.overflow ?? 0;
            return (
              <div key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-1.5 text-sm">
                <span>{tr(`steps.${rule.step}`)} <span className="text-text-dim font-mono text-xs">×{rule.per}</span></span>
                <span className="font-mono">{over} → {over * rule.per}</span>
              </div>
            );
          }
          const n = Number(getIn(values, rule.field.split('.')) ?? 0);
          return (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5 text-sm">
              <span>{t('buyExtra')}: {tr(`fields.${rule.field}`)} <span className="text-text-dim font-mono text-xs">×{rule.per}</span></span>
              <span className="inline-flex items-center gap-3">
                <button onClick={() => set(rule.field, Math.max(0, n - 1))} className="size-8 border border-line2 rounded-md text-text-mute hover:text-text">−</button>
                <span className="font-mono w-6 text-center">{n}</span>
                <button onClick={() => set(rule.field, n + 1)} className="size-8 border border-line2 rounded-md text-text-mute hover:text-text">+</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecapStep({ step, report, values, onGoto }: StepProps<'recap'>) {
  const { pkg, tr } = useSystem();
  const { t } = useI18n();
  const scope = useScope(values);
  const issues = report.checklist.filter((c) => !c.ok);
  const summary = pkg.manifest.summary;
  const rows: [string, string][] = [];
  for (const p of [summary?.title, ...(summary?.subtitle ?? [])]) if (p) rows.push([tr(`fields.${p}`), displayValue(pkg, tr, p, values) || '—']);
  for (const n of step.show) rows.push([tr(`derived.${n}`), String(scope.get([n]) ?? '—')]);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-1.5">
            <span className="eyebrow">{k}</span><span className="text-sm text-right">{v}</span>
          </div>
        ))}
      </div>
      <div className={cn('p-4 rounded-md bg-surf border', issues.length ? 'border-brand/45' : 'border-good/35')}>
        <div className={cn('eyebrow mb-2', issues.length ? 'text-brand-bright' : 'text-good')}>
          {issues.length ? `${issues.length} ${t('unresolved')}` : t('allValid')}
        </div>
        {issues.length === 0 ? (
          <div className="text-sm text-text-mute">{t('allChecksPassed')}</div>
        ) : issues.map((i) => (
          <button key={i.id} onClick={() => onGoto(i.stepId)} title={t('goToStep')} className="w-full text-left grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-1.5 border-b border-dashed border-line last:border-0 hover:bg-surf2 rounded-sm px-1 -mx-1 transition-colors">
            <span className="text-[13px]">{tr(i.labelKey)}<span className="block text-xs text-text-mute">{reasonOf(i, t)}</span></span>
            {i.val != null && <span className="font-mono text-[11px] text-text-dim self-center">{i.val}{i.need != null ? ` / ${i.need}` : ''}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- scores (point buy / standard array / roll) ----------

function ScoresStep({ step, status, values, set, onMethod }: StepProps<'scores'>) {
  const { pkg, tr } = useSystem();
  const { t } = useI18n();
  const items = groupItems(pkg.model, step.group);
  const method = status.method ?? step.methods[0];
  const get = (id: string) => Number(getIn(values, [step.group, id]) ?? 0);
  const label = (m: string) => t(m === 'pointbuy' ? 'methodPointbuy' : m === 'array' ? 'methodArray' : 'methodRoll');

  const rollAll = () => {
    const r = step.roll!;
    for (const it of items) set(`${step.group}.${it.id}`, rollNotation(r.items[it.id] ?? r.formula, Math.random).total);
  };
  const rollOne = (id: string) => set(`${step.group}.${id}`, rollNotation(step.roll!.items[id] ?? step.roll!.formula, Math.random).total);

  // Standard array: values still unassigned.
  const remaining = (() => {
    if (!step.array) return [];
    const left = [...step.array];
    for (const it of items) { const k = left.indexOf(get(it.id)); if (k >= 0) left.splice(k, 1); }
    return left;
  })();

  return (
    <div className="flex flex-col gap-5">
      {step.methods.length > 1 && (
        <div className="inline-flex p-0.5 border border-line2 rounded-md self-start">
          {step.methods.map((m) => (
            <button key={m} onClick={() => onMethod(step.id, m)} className={cn('px-3.5 py-1.5 rounded text-sm transition-colors', m === method ? 'bg-text text-bg' : 'text-text-mute hover:text-text')}>{label(m)}</button>
          ))}
        </div>
      )}

      {method === 'pointbuy' && step.pointbuy && (
        <p className="text-sm text-text-mute">
          {t('spent')} <b className={cn('font-mono', (status.overflow ?? 0) > 0 ? 'text-brand-bright' : 'text-text')}>{status.spent}</b> / {step.pointbuy.budget}
          {status.missing?.length ? <span className="text-gold"> · {step.pointbuy.min}–{step.pointbuy.max}</span> : null}
        </p>
      )}
      {method === 'array' && step.array && (
        <p className="text-sm text-text-mute">{t('arrayLeft')}: <span className="font-mono text-text">{remaining.length ? remaining.join(', ') : '—'}</span></p>
      )}
      {method === 'roll' && step.roll && (
        <button onClick={rollAll} className="self-start h-10 px-4 rounded-md bg-brand text-on-brand border border-brand hover:bg-brand-bright transition-colors text-sm">{t('rollAll')} ({step.roll.formula})</button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        {items.map((it) => {
          const v = get(it.id);
          return (
            <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 border-b border-dashed border-line">
              <span className="text-sm">{tr(`${step.group}.${it.id}`)}</span>
              <span className="inline-flex items-center gap-2">
                {method === 'pointbuy' && step.pointbuy && (
                  <>
                    <button onClick={() => set(`${step.group}.${it.id}`, Math.max(step.pointbuy!.min, v - 1))} className="size-8 border border-line2 rounded-md text-text-mute hover:text-text">−</button>
                    <span className="font-mono w-8 text-center">{v}</span>
                    <button onClick={() => set(`${step.group}.${it.id}`, Math.min(step.pointbuy!.max, v + 1))} className="size-8 border border-line2 rounded-md text-text-mute hover:text-text">+</button>
                    <span className="font-mono text-[11px] text-text-dim w-10 text-right">{step.pointbuy.costs[String(v)] ?? '–'}</span>
                  </>
                )}
                {method === 'array' && (
                  <select value={String(v)} onChange={(e) => set(`${step.group}.${it.id}`, Number(e.target.value))} className="field-select bg-ink border border-line2 rounded-md h-9 px-2 font-mono text-sm w-20">
                    <option value={v}>{v}</option>
                    {[...new Set(remaining)].filter((x) => x !== v).map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                )}
                {method === 'roll' && (
                  <>
                    <NumberInput className="w-16 bg-ink border border-line2 rounded-md h-9 px-2 text-center font-mono text-sm outline-none focus:border-brand" value={v} onChange={(n) => set(`${step.group}.${it.id}`, n)} />
                    <button onClick={() => rollOne(it.id)} title={t('rollAgain')} aria-label={t('rollAgain')} className="size-8 border border-line2 rounded-md text-text-mute hover:text-text">↻</button>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <ShownStats names={step.show} values={values} />
    </div>
  );
}

// ---------- spend a pool of points ----------

function SpendStep({ step, status, values, set }: StepProps<'spend'>) {
  const { pkg, tr } = useSystem();
  const { t } = useI18n();
  const group = pkg.model.groups[step.group];
  const field = group.field as { type: string; min?: number; max?: number };
  const items = groupItems(pkg.model, step.group);
  const cats: (string | null)[] = group.categories.length ? group.categories : [null];
  const scope = useScope(values);
  const derivedName = (pkg.sheet.roll?.value as Record<string, string> | undefined)?.[step.group];
  const min = field.min ?? 0;
  const left = (status.budget ?? 0) - ((status.spent ?? 0) + (status.overflow ?? 0));

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-mute">
        {t('spent')} <b className={cn('font-mono', (status.overflow ?? 0) > 0 ? 'text-brand-bright' : 'text-text')}>{(status.spent ?? 0) + (status.overflow ?? 0)}</b> / {status.budget} · {t('remaining')} <span className="font-mono">{left}</span>
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {cats.map((cat) => (
          <div key={cat ?? 'all'} className="md:col-span-1">
            {cat && <div className="eyebrow mb-1.5">{tr(`${step.group}.cat.${cat}`)}</div>}
            {items.filter((i) => !cat || i.cat === cat).map((it) => {
              const v = Number(getIn(values, [step.group, it.id]) ?? min);
              const total = derivedName ? scope.get([derivedName.replace('{id}', it.id)]) : undefined;
              if (field.type === 'checkbox') {
                const on = !!getIn(values, [step.group, it.id]);
                return (
                  <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5 border-b border-dashed border-line">
                    <span className="text-[13px]">{tr(`${step.group}.${it.id}`)}</span>
                    <span className="inline-flex items-center gap-3">
                      {total != null && <span className="font-mono text-xs text-text-mute">{Number(total) >= 0 ? '+' : ''}{String(total)}</span>}
                      <Dot on={on} size="lg" onClick={() => set(`${step.group}.${it.id}`, !on)} />
                    </span>
                  </div>
                );
              }
              return (
                <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5 border-b border-dashed border-line">
                  <span className="text-[13px]">{tr(`${step.group}.${it.id}`)}</span>
                  <span className="inline-flex items-center gap-2">
                    <button onClick={() => set(`${step.group}.${it.id}`, Math.max(min, v - 5))} className="h-7 px-1.5 border border-line2 rounded text-text-mute hover:text-text text-xs font-mono">−5</button>
                    <button onClick={() => set(`${step.group}.${it.id}`, Math.max(min, v - 1))} className="size-7 border border-line2 rounded text-text-mute hover:text-text">−</button>
                    <span className="font-mono w-8 text-center text-sm">{v}</span>
                    <button onClick={() => set(`${step.group}.${it.id}`, v + 1)} className="size-7 border border-line2 rounded text-text-mute hover:text-text">+</button>
                    <button onClick={() => set(`${step.group}.${it.id}`, v + 5)} className="h-7 px-1.5 border border-line2 rounded text-text-mute hover:text-text text-xs font-mono">+5</button>
                    {total != null && <span className="font-mono text-xs text-text-mute w-10 text-right">= {String(total)}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {status.capViolations && status.capViolations.length > 0 && (
        <p className="text-xs text-gold">{status.capViolations.map((id) => tr(`${step.group}.${id}`)).join(', ')} &gt; {step.maxPerItem}</p>
      )}
      <ShownStats names={step.show} values={values} />
    </div>
  );
}
