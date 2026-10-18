// Guards the interface strings: every literal t('key') in the source exists in every language,
// and the languages define the same keys.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UI } from './ui';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) && !p.endsWith(join('i18n', 'ui.ts')) ? [p] : [];
  });
}

const used = new Set<string>();
for (const f of sources('src')) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*'(\w+)'/g)) used.add(m[1]);
  // t(cond ? 'a' : 'b')
  for (const m of text.matchAll(/\bt\(\s*[^'"()]+\?\s*'(\w+)'\s*:\s*'(\w+)'/g)) { used.add(m[1]); used.add(m[2]); }
}

describe('interface strings', () => {
  const langs = Object.entries(UI) as [string, Record<string, string>][];
  it.each(langs)('%s has every key the code asks for', (_lang, dict) => {
    expect([...used].filter((k) => !(k in dict))).toEqual([]);
  });
  it('all languages define the same keys', () => {
    const [[, first], ...rest] = langs;
    for (const [lang, dict] of rest) expect(Object.keys(dict).sort(), lang).toEqual(Object.keys(first).sort());
  });
});
