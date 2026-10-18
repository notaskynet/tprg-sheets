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
import { DotRow } from '@/ui/primitives';
import { FieldEditor } from '@/ui/sheet/fields';
import { ListEditor } from '@/ui/sheet/ListEditor';
import { cn } from '@/ui/lib/utils';

export interface StepProps<K extends CreationStep['kind'] = CreationStep['kind']> {
  step: Extract<CreationStep, { kind: K }>;
  status: StepStatus;
  report: CreationReport;
  values: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
}

export function StepBody(p: StepProps) {
  const { t } = useI18n();
  switch (p.step.kind) {
    case 'fields': return <FieldsStep {...(p as StepProps<'fields'>)} />;
    case 'pick': return <PickStep {...(p as StepProps<'pick'>)} />;
    case 'priority': return <PriorityStep {...(p as StepProps<'priority'>)} />;
    case 'list': return <ListStep {...(p as StepProps<'list'>)} />;
    case 'freebies': return <FreebiesStep {...(p as StepProps<'freebies'>)} />;
    case 'recap': return <RecapStep {...(p as StepProps<'recap'>)} />;
    default: return <p className="text-text-mute text-sm">{t('stepUnsupported')}: {p.step.kind}</p>;
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

function RecapStep({ step, report, values }: StepProps<'recap'>) {
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
          <div key={i.id} className="text-[12.5px] text-text-mute py-0.5">
            · {tr(i.labelKey)}{i.val != null && <span className="font-mono text-text-dim"> — {i.val}{i.need != null ? ` / ${i.need}` : ''}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
