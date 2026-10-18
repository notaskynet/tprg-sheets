// Tiny expression language for derived values and creation rules. No eval:
// source → tokens → AST (Pratt parser). See eval.ts for evaluation.

export type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'path'; p: string[] }
  | { t: 'bin'; op: string; l: Node; r: Node }
  | { t: 'un'; op: string; e: Node }
  | { t: 'call'; fn: string; args: Node[] }
  | { t: 'idx'; e: Node; i: Node };

type Tok = { k: 'num' | 'str' | 'id' | 'op'; v: string };

const OPS = ['<=', '>=', '==', '!=', '+', '-', '*', '/', '%', '<', '>', '(', ')', '[', ']', ',', '.'];

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { out.push({ k: 'num', v: num[0] }); i += num[0].length; continue; }
    if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new Error(`Unterminated string in "${src}"`);
      out.push({ k: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) { out.push({ k: 'id', v: id[0] }); i += id[0].length; continue; }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new Error(`Unexpected "${c}" in "${src}"`);
    out.push({ k: 'op', v: op });
    i += op.length;
  }
  return out;
}

// binding powers
const BIN: Record<string, [number, number]> = {
  or: [1, 2], and: [3, 4],
  '==': [5, 6], '!=': [5, 6], '<': [5, 6], '>': [5, 6], '<=': [5, 6], '>=': [5, 6],
  '+': [7, 8], '-': [7, 8],
  '*': [9, 10], '/': [9, 10], '%': [9, 10],
};

export function parse(src: string): Node {
  const toks = lex(src);
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const isOp = (t: Tok | undefined, v: string) => t?.k === 'op' && t.v === v;
  const expect = (v: string) => {
    if (!isOp(next(), v)) throw new Error(`Expected "${v}" in "${src}"`);
  };

  function primary(): Node {
    const t = next();
    if (!t) throw new Error(`Unexpected end of "${src}"`);
    let n: Node;
    if (t.k === 'num') n = { t: 'num', v: Number(t.v) };
    else if (t.k === 'str') n = { t: 'str', v: t.v };
    else if (t.k === 'op' && t.v === '(') { n = expr(0); expect(')'); }
    else if (t.k === 'op' && t.v === '-') n = { t: 'un', op: '-', e: expr(11) };
    else if (t.k === 'id' && t.v === 'not') n = { t: 'un', op: 'not', e: expr(5) };
    else if (t.k === 'id') {
      if (isOp(peek(), '(')) {
        next();
        const args: Node[] = [];
        if (!isOp(peek(), ')')) {
          do args.push(expr(0)); while (isOp(peek(), ',') && next());
        }
        expect(')');
        n = { t: 'call', fn: t.v, args };
      } else {
        const p = [t.v];
        while (isOp(peek(), '.')) {
          next();
          const seg = next();
          if (seg?.k !== 'id' && seg?.k !== 'num') throw new Error(`Bad path in "${src}"`);
          p.push(seg.v);
        }
        n = { t: 'path', p };
      }
    } else throw new Error(`Unexpected "${t.v}" in "${src}"`);
    while (isOp(peek(), '[')) {
      next();
      const i = expr(0);
      expect(']');
      n = { t: 'idx', e: n, i };
    }
    return n;
  }

  function expr(minBp: number): Node {
    let l = primary();
    for (;;) {
      const t = peek();
      const op = t && (t.k === 'op' || (t.k === 'id' && (t.v === 'and' || t.v === 'or'))) ? t.v : null;
      const bp = op ? BIN[op] : undefined;
      if (!op || !bp || bp[0] < minBp) break;
      next();
      l = { t: 'bin', op, l, r: expr(bp[1]) };
    }
    return l;
  }

  const ast = expr(0);
  if (pos < toks.length) throw new Error(`Unexpected "${toks[pos].v}" in "${src}"`);
  return ast;
}
