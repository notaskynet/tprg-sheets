// Generic character: system ref + a values tree shaped by the system's model.
// Derived values are never stored; see expr/createScope.
import { groupItems, type FieldDef, type Model } from './schema';
import { type Values } from './expr/eval';

export const CHARACTER_SCHEMA = 1;

export interface Character {
  id: string;
  system: { id: string; version: string };
  schema: number;
  updatedAt: number;
  values: Values;
  /** Uploaded picture as a small data URL. */
  avatar?: string;
  creation?: { step: number; done: boolean; methods?: Record<string, string> };
}

function defaultOfField(f: FieldDef): unknown {
  switch (f.type) {
    case 'text':
    case 'longtext':
    case 'select':
      return f.default;
    case 'pool':
      return f.full || f.initial ? undefined : f.default;
    case 'number':
    case 'percent':
    case 'checkbox':
    case 'checkboxes':
      return f.default;
    case 'dots':
      return f.default ?? f.min;
    case 'list':
      return [];
    case 'damage-track':
      return Object.fromEntries(f.kinds.map((k) => [k, 0]));
  }
}

function setIn<T>(obj: T, path: string[], value: unknown): T {
  if (!path.length) return value as T;
  const [head, ...rest] = path;
  const base = (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>;
  return { ...base, [head]: setIn(base[head], rest, value) } as T;
}

function defaultValues(model: Model): Values {
  let v: Values = {};
  for (const [gid, g] of Object.entries(model.groups)) {
    for (const it of groupItems(model, gid)) v = setIn(v, [gid, it.id], defaultOfField(g.field));
  }
  for (const [path, f] of Object.entries(model.fields)) v = setIn(v, path.split('.'), defaultOfField(f));
  return v;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Deep merge: raw wins, missing keys come from defaults, unknown keys in raw are kept. */
function merge(base: unknown, raw: unknown): unknown {
  if (!isObj(base) || !isObj(raw)) return raw === undefined ? base : raw;
  const out: Record<string, unknown> = { ...base };
  for (const [k, rv] of Object.entries(raw)) out[k] = merge(base[k], rv);
  return out;
}

export function hydrateValues(model: Model, raw: Values | undefined): Values {
  return merge(defaultValues(model), raw ?? {}) as Values;
}

export function newCharacter(model: Model, system: { id: string; version: string }, id: string): Character {
  return {
    id,
    system,
    schema: CHARACTER_SCHEMA,
    updatedAt: Date.now(),
    values: defaultValues(model),
    creation: { step: 0, done: false },
  };
}

export function setValue(ch: Character, path: string, value: unknown): Character {
  return { ...ch, updatedAt: Date.now(), values: setIn(ch.values, path.split('.'), value) };
}
