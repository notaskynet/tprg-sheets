// Zod schema for a system package (the parsed content of system/model/sheet/
// creation/locales TOML files). Types are inferred from it, so the schema is the
// single source of truth. Sheet blocks stay loose until the SheetRenderer lands.
import { z } from 'zod';

const id = z.string().regex(/^[A-Za-z0-9_]+$/, 'ids may only contain letters, digits and _');
const expr = z.string().min(1); // expression source, see engine/expr

// ---------- model ----------

const dotsLike = { min: z.number().default(0), max: z.number().default(5), default: z.number().optional() };

export const FieldDef = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), default: z.string().default('') }),
  z.object({ type: z.literal('longtext'), default: z.string().default('') }),
  z.object({
    type: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    default: z.number().default(0),
  }),
  z.object({ type: z.literal('dots'), ...dotsLike }),
  z.object({ type: z.literal('percent'), default: z.number().default(0) }),
  z.object({ type: z.literal('checkbox'), default: z.boolean().default(false) }),
  z.object({
    type: z.literal('select'),
    from: id.optional(), // catalog id
    options: z.array(z.string()).optional(),
    default: z.string().default(''),
  }),
  z.object({
    type: z.literal('list'),
    item: z.enum(['dots', 'number', 'note', 'text']).default('dots'),
    suggest: id.optional(), // catalog id offering quick-picks
    max: z.number().default(5), // max dots / number per row
  }),
  z.object({
    type: z.literal('damage-track'),
    levels: z.array(id).min(1), // ordered level ids
    kinds: z.array(id).default(['bashing', 'lethal', 'aggravated']), // weakest → strongest
  }),
  z.object({ type: z.literal('pool'), max: expr, default: z.number().default(0) }),
  z.object({ type: z.literal('checkboxes'), count: z.number().int().positive(), default: z.number().default(0) }),
]);
export type FieldDef = z.infer<typeof FieldDef>;

const GroupItem = z.looseObject({ id, cat: id.optional() });
export const Group = z
  .object({
    categories: z.array(id).default([]),
    field: FieldDef,
    items: z.array(GroupItem).default([]),
    itemsFrom: id.optional(), // reuse another group's items (e.g. specialties per ability)
  })
  .refine((g) => g.items.length > 0 || g.itemsFrom, { message: 'needs items or itemsFrom' });
export type Group = z.infer<typeof Group>;

export const Catalog = z.object({ items: z.array(z.looseObject({ id })).default([]) });
export type Catalog = z.infer<typeof Catalog>;

const TableRow = z.union([z.number(), z.array(z.number())]);
export const Model = z.object({
  groups: z.record(id, Group).default({}),
  catalogs: z.record(id, Catalog).default({}),
  fields: z.record(z.string(), FieldDef).default({}), // key = dotted path in values
  derived: z.record(id, expr).default({}),
  tables: z.record(id, z.record(z.string(), TableRow)).default({}),
});
export type Model = z.infer<typeof Model>;

/** Items of a group, following `itemsFrom`. */
export function groupItems(model: Model, gid: string): Group['items'] {
  const g = model.groups[gid];
  if (!g) return [];
  return g.itemsFrom ? groupItems(model, g.itemsFrom) : g.items;
}

// ---------- dice ----------

export const DiceConfig = z.discriminatedUnion('mechanic', [
  z.object({
    mechanic: z.literal('pool-successes'),
    die: z.number().int().default(10),
    defaultDifficulty: z.number().int().default(6),
    onesCancel: z.boolean().default(true),
    specialty: z.enum(['extra-die', 'none']).default('extra-die'),
  }),
  z.object({
    mechanic: z.literal('d20-modifier'),
    critSuccess: z.number().int().default(20),
    critFail: z.number().int().default(1),
  }),
  z.object({ mechanic: z.literal('d100-under') }),
  z.object({ mechanic: z.literal('notation') }),
]);
export type DiceConfig = z.infer<typeof DiceConfig>;

// ---------- sheet (loose until stage 4) ----------

export const Block = z.looseObject({ type: z.string() });
export const Section = z.object({
  id,
  title: z.string().optional(), // label key
  columns: z.number().int().min(1).max(4).default(1),
  blocks: z.array(Block).default([]),
});
export const Sheet = z.object({
  roll: z.looseObject({}).optional(), // which groups form a roll pool, specialties group, penalty derived
  sections: z.array(Section).default([]),
});
export type Sheet = z.infer<typeof Sheet>;

// ---------- creation ----------

const stepBase = { id, title: z.string().optional() }; // title = label key, default `steps.<id>`

export const CreationStep = z.discriminatedUnion('kind', [
  z.object({
    ...stepBase,
    kind: z.literal('fields'),
    fields: z.array(z.string()).min(1),
    required: z.array(z.string()).optional(), // default: all fields
  }),
  z.object({
    ...stepBase,
    kind: z.literal('pick'),
    field: z.string(),
    from: id, // catalog id
    fields: z.array(z.string()).default([]), // extra fields shown on the same step
  }),
  z.object({
    ...stepBase,
    kind: z.literal('priority'),
    group: id,
    budgets: z.array(z.number()).min(1), // per category, assigned by priority (e.g. [7,5,3])
    base: z.number().default(0), // value every item starts at (not counted against the budget)
    maxPerItem: z.number().optional(),
  }),
  z.object({
    ...stepBase,
    kind: z.literal('pointbuy'),
    group: id,
    budget: z.union([z.number(), expr]),
    costs: z.record(z.string(), z.number()), // value → cumulative cost
    min: z.number(),
    max: z.number(),
  }),
  z.object({ ...stepBase, kind: z.literal('array'), group: id, values: z.array(z.number()).min(1) }),
  z.object({ ...stepBase, kind: z.literal('roll'), group: id, formula: z.string() }),
  z.object({
    ...stepBase,
    kind: z.literal('list'),
    field: z.string(), // a `list` field (e.g. disciplines)
    budget: z.number(),
    scope: expr.optional(), // expr yielding allowed catalog ids
  }),
  z.object({
    ...stepBase,
    kind: z.literal('freebies'),
    budget: z.number(),
    // Each rule charges `per` freebies for every point beyond a base:
    //  - { step, per }: overflow of an earlier budget step (priority / list / pointbuy)
    //  - { field, per }: a numeric field that stores points bought above the base (value × per)
    costs: z.array(
      z.union([
        z.object({ step: id, per: z.number() }),
        z.object({ field: z.string(), per: z.number() }),
      ]),
    ),
  }),
  z.object({ ...stepBase, kind: z.literal('recap') }),
]);
export type CreationStep = z.infer<typeof CreationStep>;
export const Creation = z.object({ steps: z.array(CreationStep).default([]) });
export type Creation = z.infer<typeof Creation>;

// ---------- manifest + package ----------

export const Manifest = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase letters, digits and -'),
  version: z.string(),
  name: z.record(z.string(), z.string()),
  languages: z.array(z.string()).min(1),
  dice: DiceConfig,
});
export type Manifest = z.infer<typeof Manifest>;

export type Locale = Record<string, string>; // flattened dotted keys

export interface SystemPackage {
  manifest: Manifest;
  model: Model;
  sheet: Sheet;
  creation: Creation;
  locales: Record<string, Locale>;
}
