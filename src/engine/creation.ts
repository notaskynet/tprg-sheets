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
  method?: string; // scores: the chosen method
  invalid?: string[]; // spend: ticked items outside the step's `scope`
}

export interface CheckItem {
  id: string;
  ok: boolean;
  labelKey: string; // locale key
  val?: string | number;
  need?: string | number;
  stepId: string; // the creation step that fixes this item
  empty?: boolean; // a field that still has no value
  missing?: number; // points still to spend inside the budget
  over?: number; // points beyond the budget
}

export interface CreationReport {
  steps: StepStatus[];
  freebies?: { spent: number; budget: number };
  checklist: CheckItem[];
}

const toIds = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const nonEmpty = (v: unknown) => v != null && v !== '' && v !== 0;
const n = (v: unknown) => (typeof v === 'number' ? v : v === true ? 1 : 0);

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

function scoresStatus(pkg: SystemPackage, step: Extract<CreationStep, { kind: 'scores' }>, ch: Character): StepStatus {
  const method = ch.creation?.methods?.[step.id] ?? step.methods[0];
  const items = groupItems(pkg.model, step.group);
  const store = (ch.values[step.group] ?? {}) as Record<string, unknown>;
  const vals = items.map((i) => n(store[i.id]));
  const base: StepStatus = { id: step.id, kind: step.kind, ok: true, method };
  if (method === 'pointbuy' && step.pointbuy) {
    const pb = step.pointbuy;
    const inRange = vals.every((v) => v >= pb.min && v <= pb.max);
    const spent = vals.reduce((s, v) => s + (pb.costs[String(v)] ?? 0), 0);
    return { ...base, ok: inRange && spent <= pb.budget, spent, budget: pb.budget, overflow: Math.max(0, spent - pb.budget), missing: inRange ? [] : ['range'] };
  }
  if (method === 'array' && step.array) {
    const a = [...step.array].sort((x, y) => x - y).join();
    return { ...base, ok: [...vals].sort((x, y) => x - y).join() === a };
  }
  if (method === 'roll') {
    const def = (pkg.model.groups[step.group].field as { default?: number }).default ?? 0;
    return { ...base, ok: vals.some((v) => v !== def) };
  }
  return base;
}

export function evaluateCreation(pkg: SystemPackage, ch: Character, scope: Scope = createScope(pkg.model, ch.values)): CreationReport {
  const steps: StepStatus[] = [];
  const checklist: CheckItem[] = [];
  const get = (path: string) => getIn(ch.values, path.split('.'));

  for (const step of pkg.creation.steps) {
    if (step.when && !scope.run(step.when)) continue; // step is not part of this character's creation
    switch (step.kind) {
      case 'fields': {
        const req = step.required ?? step.fields;
        const shown = (f: string) => { const w = pkg.model.fields[f]?.when; return !w || !!scope.run(w); }; // a hidden field cannot be missing
        const missing = req.filter((f) => shown(f) && !nonEmpty(get(f)));
        steps.push({ id: step.id, kind: step.kind, ok: missing.length === 0, missing });
        for (const f of req) checklist.push({ id: f, ok: nonEmpty(get(f)), labelKey: `fields.${f}`, stepId: step.id, empty: !nonEmpty(get(f)) });
        break;
      }
      case 'pick': {
        const ok = nonEmpty(get(step.field));
        steps.push({ id: step.id, kind: step.kind, ok, missing: ok ? [] : [step.field] });
        checklist.push({ id: step.field, ok, labelKey: `fields.${step.field}`, stepId: step.id, empty: !ok });
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
          stepId: step.id,
          missing: st.ranks!.reduce((m, r) => m + Math.max(0, r.budget - r.spent), 0),
          over: st.overflow,
        });
        break;
      }
      case 'list': {
        const st = listStatus(step, ch);
        steps.push(st);
        checklist.push({ id: step.id, ok: st.ok, labelKey: `steps.${step.id}`, val: st.spent! + st.overflow!, need: step.budget, stepId: step.id, missing: step.budget - st.spent!, over: st.overflow });
        break;
      }
      case 'scores': {
        const st = scoresStatus(pkg, step, ch);
        steps.push(st);
        checklist.push({ id: step.id, ok: st.ok, labelKey: `steps.${step.id}`, stepId: step.id, ...(st.budget != null ? { val: st.spent, need: st.budget, missing: Math.max(0, st.budget - (st.spent ?? 0)), over: st.overflow } : { empty: !st.ok }) });
        break;
      }
      case 'spend': {
        const budget = typeof step.budget === 'number' ? step.budget : Number(scope.run(step.budget) ?? 0);
        const allowed = step.scope ? new Set(toIds(scope.run(step.scope))) : null;
        const free = scope.granted(step.group); // granted items are on for free and not charged
        const items = groupItems(pkg.model, step.group).filter((i) => !free.has(i.id));
        const store = (ch.values[step.group] ?? {}) as Record<string, unknown>;
        const min = (pkg.model.groups[step.group].field as { min?: number }).min ?? 0;
        const chosen = items.filter((i) => n(store[i.id]) > min);
        const invalid = allowed ? chosen.filter((i) => !allowed.has(i.id)).map((i) => i.id) : [];
        const spent = chosen.filter((i) => !invalid.includes(i.id)).reduce((sum, i) => sum + n(store[i.id]) - min, 0);
        const capViolations = step.maxPerItem != null ? items.filter((i) => n(store[i.id]) > step.maxPerItem!).map((i) => i.id) : [];
        const st: StepStatus = { id: step.id, kind: step.kind, ok: spent >= budget && invalid.length === 0, spent: Math.min(spent, budget), budget, overflow: Math.max(0, spent - budget), capViolations, invalid };
        steps.push(st);
        checklist.push({ id: step.id, ok: st.ok, labelKey: `steps.${step.id}`, val: spent, need: budget, stepId: step.id, missing: Math.max(0, budget - spent), over: st.overflow });
        break;
      }
      case 'freebies':
      case 'recap':
        break; // handled below (need the other steps' overflow)
    }
  }

  let freebies: CreationReport['freebies'];
  const fb = pkg.creation.steps.find((s): s is Extract<CreationStep, { kind: 'freebies' }> => s.kind === 'freebies');
  if (fb) {
    let spent = 0;
    const budget = typeof fb.budget === 'number' ? fb.budget : Math.max(0, n(scope.run(fb.budget)));
    for (const rule of fb.costs) {
      if ('step' in rule) spent += (steps.find((s) => s.id === rule.step)?.overflow ?? 0) * rule.per;
      else spent += Math.max(0, n(scope.get(rule.field.split('.')))) * rule.per;
    }
    freebies = { spent, budget };
    steps.push({ id: fb.id, kind: 'freebies', ok: spent <= budget, spent, budget, overflow: Math.max(0, spent - budget) });
    checklist.push({ id: fb.id, ok: spent <= budget, labelKey: `steps.${fb.id}`, val: spent, need: budget, stepId: fb.id, over: Math.max(0, spent - budget) });
  }
  const recap = pkg.creation.steps.find((s) => s.kind === 'recap');
  if (recap) steps.push({ id: recap.id, kind: 'recap', ok: checklist.every((c) => c.ok) });

  return { steps, freebies, checklist };
}
