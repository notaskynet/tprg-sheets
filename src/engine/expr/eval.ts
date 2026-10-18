// Evaluator + scope for the expression language. A Scope binds a model to one
// character's values and lazily computes (and memoizes) `derived` entries.
import { groupItems, type Model } from '../schema';
import { parse, type Node } from './parse';

export type Values = Record<string, unknown>;

export interface Scope {
  /** Evaluate an expression source against this character. */
  run(src: string): unknown;
  /** Value of a derived entry by name. */
  derived(name: string): unknown;
  /** Resolve a dotted path: character values first, then derived. */
  get(path: string[]): unknown;
  /** Item ids of a group that its `granted` expression switches on for free. */
  granted(group: string): Set<string>;
}

const astCache = new Map<string, Node>();
export function compile(src: string): Node {
  let n = astCache.get(src);
  if (!n) astCache.set(src, (n = parse(src)));
  return n;
}

export function getIn(obj: unknown, path: string[]): unknown {
  let cur = obj;
  for (const seg of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

const num = (v: unknown): number =>
  typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : typeof v === 'string' && v !== '' && !isNaN(+v) ? +v : 0;

function sumOf(v: unknown): number {
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.reduce((s, x) => s + num((x as { level?: unknown })?.level ?? x), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce<number>((s, x) => s + num(x), 0);
  return 0;
}

/** table lookup: exact key, else the greatest numeric key <= value (clamped to the first key). */
export function tableLookup(table: Record<string, number | number[]> | undefined, key: unknown): number | number[] {
  if (!table) throw new Error('Unknown table');
  const k = String(key);
  if (k in table) return table[k];
  const keys = Object.keys(table).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
  if (!keys.length) return 0;
  const n = num(key);
  let pick = keys[0];
  for (const x of keys) if (x <= n) pick = x;
  return table[String(pick)];
}

export function createScope(model: Model, values: Values): Scope {
  const memo = new Map<string, unknown>();
  const stack: string[] = [];

  function derived(name: string): unknown {
    if (memo.has(name)) return memo.get(name);
    const src = model.derived[name];
    if (src == null) return undefined;
    if (stack.includes(name)) throw new Error(`Derived cycle: ${[...stack, name].join(' → ')}`);
    stack.push(name);
    try {
      const v = ev(compile(src));
      memo.set(name, v);
      return v;
    } finally {
      stack.pop();
    }
  }

  const grantedMemo = new Map<string, Set<string>>();
  function granted(group: string): Set<string> {
    let g = grantedMemo.get(group);
    if (!g) {
      const src = model.groups[group]?.granted;
      grantedMemo.set(group, (g = new Set()));
      if (src) for (const x of toList(ev(compile(src)))) g.add(String(x));
    }
    return g;
  }

  function get(path: string[]): unknown {
    if (path.length === 2 && granted(path[0]).has(path[1])) return true;
    const v = getIn(values, path);
    if (v !== undefined) return v;
    if (path.length === 1) return derived(path[0]);
    return undefined;
  }

  // sum()/count() take a path *unevaluated* so `sum(attributes.physical)` can mean a category.
  function sumPath(n: Node): number {
    if (n.t !== 'path') return sumOf(ev(n));
    const [head, second] = n.p;
    const group = model.groups[head];
    if (group) {
      const items = groupItems(model, head).filter((it) => n.p.length === 1 || it.cat === second);
      const store = (values[head] ?? {}) as Record<string, unknown>;
      const free = granted(head);
      return items.reduce((s, it) => s + (free.has(it.id) ? 1 : num(store[it.id] ?? defaultOf(group.field))), 0);
    }
    return sumOf(get(n.p));
  }

  function ev(n: Node): unknown {
    switch (n.t) {
      case 'num':
      case 'str':
        return n.v;
      case 'path': {
        if (n.p.length === 1 && n.p[0] === 'true') return true;
        if (n.p.length === 1 && n.p[0] === 'false') return false;
        return get(n.p);
      }
      case 'un':
        return n.op === 'not' ? !ev(n.e) : -num(ev(n.e));
      case 'idx': {
        const base = ev(n.e);
        return Array.isArray(base) ? base[num(ev(n.i))] : undefined;
      }
      case 'bin': {
        if (n.op === 'and') return Boolean(ev(n.l)) && Boolean(ev(n.r));
        if (n.op === 'or') return Boolean(ev(n.l)) || Boolean(ev(n.r));
        const l = ev(n.l);
        const r = ev(n.r);
        switch (n.op) {
          case '==': return l === r || (typeof l !== 'object' && num(l) === num(r) && (typeof l === 'number' || typeof r === 'number'));
          case '!=': return !(l === r || (typeof l !== 'object' && num(l) === num(r) && (typeof l === 'number' || typeof r === 'number')));
          case '<': return num(l) < num(r);
          case '>': return num(l) > num(r);
          case '<=': return num(l) <= num(r);
          case '>=': return num(l) >= num(r);
          case '+': return num(l) + num(r);
          case '-': return num(l) - num(r);
          case '*': return num(l) * num(r);
          case '/': return num(r) === 0 ? 0 : num(l) / num(r);
          case '%': return num(r) === 0 ? 0 : num(l) % num(r);
        }
        throw new Error(`Unknown operator ${n.op}`);
      }
      case 'call':
        return call(n.fn, n.args);
    }
  }

  function call(fn: string, args: Node[]): unknown {
    switch (fn) {
      case 'sum': return sumPath(args[0]);
      case 'count': {
        const a = args[0];
        const v = a.t === 'path' ? get(a.p) : ev(a);
        return Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
      }
      case 'if': return ev(args[0]) ? ev(args[1]) : args[2] ? ev(args[2]) : 0;
      case 'min': return Math.min(...args.map((a) => num(ev(a))));
      case 'max': return Math.max(...args.map((a) => num(ev(a))));
      case 'floor': return Math.floor(num(ev(args[0])));
      case 'ceil': return Math.ceil(num(ev(args[0])));
      case 'round': return Math.round(num(ev(args[0])));
      case 'abs': return Math.abs(num(ev(args[0])));
      case 'has': {
        const list = ev(args[0]);
        const x = ev(args[1]);
        return Array.isArray(list) && list.some((y) => y === x);
      }
      case 'concat': return args.flatMap((a) => toList(ev(a)));
      case 'upto': {
        const map = ev(args[0]);
        const level = num(ev(args[1]));
        if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
        return Object.keys(map)
          .map(Number)
          .filter((k) => !isNaN(k) && k <= level)
          .sort((a, b) => a - b)
          .flatMap((k) => toList((map as Record<string, unknown>)[String(k)]));
      }
      case 'table': return tableLookup(model.tables[String(ev(args[0]))], ev(args[1]));
      case 'lookup': {
        const cat = model.catalogs[String(ev(args[0]))];
        const id = ev(args[1]);
        const item = cat?.items.find((it) => it.id === id);
        return item ? (item as Record<string, unknown>)[String(ev(args[2]))] : undefined;
      }
      default:
        throw new Error(`Unknown function "${fn}"`);
    }
  }

  return { run: (src) => ev(compile(src)), derived, get, granted };
}

/** A list value: arrays as they are, a single string as one element, anything else as empty. */
function toList(v: unknown): unknown[] {
  return Array.isArray(v) ? v : typeof v === 'string' && v !== '' ? [v] : [];
}

function defaultOf(f: { type: string; default?: unknown; min?: number }): unknown {
  return f.default ?? f.min ?? 0;
}
