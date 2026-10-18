// Creation engine: evaluates a character against the system's creation steps.
// Budgets, overflow ("freebies") and the checklist are all derived from
// creation.toml — systems declare constraints, never validator code.
import { groupItems, type CreationStep, type SystemPackage } from './schema';
import { createScope, getIn, type Scope } from './expr/eval';
import type { Character } from './character';

export interface StepStatus {
  id: string;
  kind: CreationStep['kind'];
  ok: boolean; // requirement met (budget filled / fields set)
  spent?: number; // points used inside the step's budget
  budget?: number;
  overflow?: number; // points beyond the budget (charged as freebies)
  /** priority: per-rank breakdown, sorted high → low */
  ranks?: { cat: string | null; spent: number; budget: number }[];
  capViolations?: string[]; // item ids above maxPerItem
  missing?: string[]; // fields/pick: required paths still empty
}

export interface CheckItem {
  id: string;
  ok: boolean;
  labelKey: string; // locale key
  val?: string | number;
  need?: string | number;
}

export interface CreationReport {
  steps: StepStatus[];
  freebies?: { spent: number; budget: number };
  checklist: CheckItem[];
}

const nonEmpty = (v: unknown) => v != null && v !== '' && v !== 0;
const n = (v: unknown) => (typeof v === 'number' ? v : 0);

function priorityStatus(pkg: SystemPackage, step: Extract<CreationStep, { kind: 'priority' }>, ch: Character): StepStatus {
  const group = pkg.model.groups[step.group];
  const items = groupItems(pkg.model, step.group);
  const store = (ch.values[step.group] ?? {}) as Record<string, unknown>;
  const cats: (string | null)[] = group.categories.length ? group.categories : [null];
  const excess = cats.map((cat) => {
    const its = items.filter((i) => cat == null || i.cat === cat);
    return { cat, spent: its.reduce((s, i) => s + n(store[i.id]) - step.base, 0) };
  });
  excess.sort((a, b) => b.spent - a.spent);
  const budgets = [...step.budgets].sort((a, b) => b - a);
  const ranks = excess.map((e, i) => ({ ...e, budget: budgets[i] ?? 0 }));
  const capViolations =
    step.maxPerItem != null ? items.filter((i) => n(store[i.id]) > step.maxPerItem!).map((i) => i.id) : [];
  return {
    id: step.id,
    kind: step.kind,
    ok: ranks.every((r) => r.spent >= r.budget),
    spent: ranks.reduce((s, r) => s + Math.min(r.spent, r.budget), 0),
    budget: budgets.reduce((a, b) => a + b, 0),
    overflow: ranks.reduce((s, r) => s + Math.max(0, r.spent - r.budget), 0),
    ranks,
    capViolations,
  };
}

function listStatus(step: Extract<CreationStep, { kind: 'list' }>, ch: Character): StepStatus {
  const rows = (getIn(ch.values, step.field.split('.')) ?? []) as { level?: number }[];
  const total = rows.reduce((s, r) => s + n(r.level), 0);
  return {
    id: step.id,
    kind: step.kind,
    ok: total >= step.budget,
    spent: Math.min(total, step.budget),
    budget: step.budget,
    overflow: Math.max(0, total - step.budget),
  };
}

export function evaluateCreation(pkg: SystemPackage, ch: Character, scope: Scope = createScope(pkg.model, ch.values)): CreationReport {
  const steps: StepStatus[] = [];
  const checklist: CheckItem[] = [];
  const get = (path: string) => getIn(ch.values, path.split('.'));

  for (const step of pkg.creation.steps) {
    switch (step.kind) {
      case 'fields': {
        const req = step.required ?? step.fields;
        const missing = req.filter((f) => !nonEmpty(get(f)));
        steps.push({ id: step.id, kind: step.kind, ok: missing.length === 0, missing });
        for (const f of req) checklist.push({ id: f, ok: nonEmpty(get(f)), labelKey: `fields.${f}` });
        break;
      }
      case 'pick': {
        const ok = nonEmpty(get(step.field));
        steps.push({ id: step.id, kind: step.kind, ok, missing: ok ? [] : [step.field] });
        checklist.push({ id: step.field, ok, labelKey: `fields.${step.field}` });
        break;
      }
      case 'priority': {
        const st = priorityStatus(pkg, step, ch);
        steps.push(st);
        checklist.push({
          id: step.id,
          ok: st.ok,
          labelKey: `steps.${step.id}`,
          val: st.ranks!.map((r) => r.spent).join('/'),
          need: [...step.budgets].sort((a, b) => b - a).join('/'),
        });
        break;
      }
      case 'list': {
        const st = listStatus(step, ch);
        steps.push(st);
        checklist.push({ id: step.id, ok: st.ok, labelKey: `steps.${step.id}`, val: st.spent! + st.overflow!, need: step.budget });
        break;
      }
      case 'pointbuy':
      case 'array':
      case 'roll':
        steps.push({ id: step.id, kind: step.kind, ok: true }); // evaluated when D&D/CoC packages land
        break;
      case 'freebies':
      case 'recap':
        break; // handled below (need the other steps' overflow)
    }
  }

  let freebies: CreationReport['freebies'];
  const fb = pkg.creation.steps.find((s): s is Extract<CreationStep, { kind: 'freebies' }> => s.kind === 'freebies');
  if (fb) {
    let spent = 0;
    for (const rule of fb.costs) {
      if ('step' in rule) spent += (steps.find((s) => s.id === rule.step)?.overflow ?? 0) * rule.per;
      else spent += Math.max(0, n(scope.get(rule.field.split('.')))) * rule.per;
    }
    freebies = { spent, budget: fb.budget };
    steps.push({ id: fb.id, kind: 'freebies', ok: spent <= fb.budget, spent, budget: fb.budget, overflow: Math.max(0, spent - fb.budget) });
    checklist.push({ id: fb.id, ok: spent <= fb.budget, labelKey: `steps.${fb.id}`, val: spent, need: fb.budget });
  }
  const recap = pkg.creation.steps.find((s) => s.kind === 'recap');
  if (recap) steps.push({ id: recap.id, kind: 'recap', ok: checklist.every((c) => c.ok) });

  return { steps, freebies, checklist };
}
