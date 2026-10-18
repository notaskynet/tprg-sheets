// Dice notation: NdM, drop/keep (dl1, dh1, kh3, kl2), + - * / and parentheses.
// "4d6dl1" (drop lowest), "(2d6+6)*5", "3d6*5", "2d6+3".
import type { Rng } from './index';

export interface NotationResult { total: number; dice: number[] }

type Tok = { k: 'num' | 'd' | 'mod' | 'op'; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+)|(dl|dh|kh|kl)|(d)|([-+*/()]))/iy;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) { if (/^\s*$/.test(src.slice(i))) break; throw new Error(`Bad dice notation "${src}"`); }
    i = re.lastIndex;
    if (m[1] != null) out.push({ k: 'num', v: m[1] });
    else if (m[2]) out.push({ k: 'mod', v: m[2].toLowerCase() });
    else if (m[3]) out.push({ k: 'd', v: 'd' });
    else out.push({ k: 'op', v: m[4] });
  }
  return out;
}

export function rollNotation(src: string, rng: Rng): NotationResult {
  const toks = lex(src);
  let pos = 0;
  const all: number[] = [];
  const peek = () => toks[pos];
  const isOp = (v: string) => peek()?.k === 'op' && peek().v === v;
  const bad = () => new Error(`Bad dice notation "${src}"`);

  function dice(count: number): number {
    pos++; // 'd'
    const sides = peek();
    if (sides?.k !== 'num') throw bad();
    pos++;
    const n = Number(sides.v);
    if (n < 1 || count > 1000) throw bad();
    let rolls = Array.from({ length: count }, () => Math.floor(rng() * n) + 1);
    all.push(...rolls);
    const mod = peek();
    if (mod?.k === 'mod') {
      pos++;
      const arg = peek();
      const k = arg?.k === 'num' ? Number(arg.v) : 1;
      if (arg?.k === 'num') pos++;
      const sorted = [...rolls].sort((a, b) => a - b);
      rolls = mod.v === 'dl' ? sorted.slice(k) : mod.v === 'dh' ? sorted.slice(0, Math.max(0, sorted.length - k)) : mod.v === 'kh' ? sorted.slice(Math.max(0, sorted.length - k)) : sorted.slice(0, k);
    }
    return rolls.reduce((a, b) => a + b, 0);
  }

  function factor(): number {
    const t = peek();
    if (!t) throw bad();
    if (t.k === 'op' && t.v === '(') { pos++; const v = expr(); if (!isOp(')')) throw bad(); pos++; return v; }
    if (t.k === 'op' && t.v === '-') { pos++; return -factor(); }
    if (t.k === 'd') return dice(1); // "d20"
    if (t.k === 'num') {
      pos++;
      return peek()?.k === 'd' ? dice(Number(t.v)) : Number(t.v);
    }
    throw bad();
  }
  function term(): number {
    let v = factor();
    while (isOp('*') || isOp('/')) { const op = peek().v; pos++; const r = factor(); v = op === '*' ? v * r : r === 0 ? 0 : Math.floor(v / r); }
    return v;
  }
  function expr(): number {
    let v = term();
    while (isOp('+') || isOp('-')) { const op = peek().v; pos++; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }

  if (!toks.length) throw bad();
  const total = expr();
  if (pos < toks.length) throw bad();
  return { total, dice: all };
}
