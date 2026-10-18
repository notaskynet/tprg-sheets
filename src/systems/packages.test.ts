// Checks every bundled package: it loads, every label the UI will ask for exists in every
// declared language, and every expression evaluates on a blank character.
import { describe, expect, it } from 'vitest';
import { BUILTIN_PACKAGES } from './builtin';
import { newCharacter } from '@/engine/character';
import { createScope } from '@/engine/expr/eval';
import { evaluateCreation } from '@/engine/creation';
import type { SystemPackage } from '@/engine/schema';

type Block = { type: string; [k: string]: unknown };
const flat = (blocks: Block[]): Block[] => blocks.flatMap((b) => [b, ...(b.type === 'stack' ? flat(b.blocks as Block[]) : [])]);

function requiredKeys(pkg: SystemPackage): string[] {
  const keys: string[] = [];
  const m = pkg.model;
  for (const [gid, g] of Object.entries(m.groups)) {
    keys.push(`${gid}.title`, ...g.categories.map((c) => `${gid}.cat.${c}`));
    if (!g.itemsFrom) keys.push(...g.items.map((i) => `${gid}.${i.id}`));
  }
  for (const [cid, c] of Object.entries(m.catalogs)) keys.push(...c.items.map((i) => `${cid}.${i.id}`));
  for (const [path, f] of Object.entries(m.fields)) {
    keys.push(`fields.${path}`);
    if (f.type === 'damage-track') keys.push(...f.levels.map((l) => `levels.${l}`), ...f.kinds.map((k) => `damage.${k}`));
  }
  const derived = new Set<string>();
  const sm = pkg.manifest.summary;
  sm?.stats.forEach((s) => { if (m.derived[s]) derived.add(s); });
  for (const s of pkg.creation.steps) {
    keys.push(`steps.${s.id}`, `guide.${s.id}`); // every step explains itself
    s.show.forEach((d) => derived.add(d));
    // every form field in the wizard says what it is for
    if (s.kind === 'fields') keys.push(...s.fields.map((f) => `help.${f}`));
    if (s.kind === 'pick') keys.push(`help.${s.field}`, ...s.fields.map((f) => `help.${f}`));
  }
  // every option the user picks from carries a one-line description
  const pickable = new Set<string>();
  for (const f of Object.values(m.fields)) {
    if ((f.type === 'select' && f.from) || (f.type === 'text' && f.suggest) || (f.type === 'list' && f.suggest)) pickable.add((f as { from?: string; suggest?: string }).from ?? (f as { suggest?: string }).suggest!);
  }
  for (const cid of pickable) keys.push(...m.catalogs[cid].items.map((i) => `desc.${cid}.${i.id}`));
  for (const sec of pkg.sheet.sections) {
    if (sec.title) keys.push(sec.title);
    for (const b of flat(sec.blocks as Block[])) {
      if (b.type === 'stepper') derived.add(b.derived as string);
      if (b.type === 'pool' && b.note) derived.add(b.note as string);
      if (b.type === 'stats') (b.items as string[]).forEach((i) => { if (!m.fields[i]) derived.add(i); });
    }
  }
  derived.forEach((d) => keys.push(`derived.${d}`));
  return keys;
}

describe.each(BUILTIN_PACKAGES.map((p) => [p.manifest.id, p] as const))('package %s', (_id, pkg) => {
  it('has every label in every declared language', () => {
    for (const lang of pkg.manifest.languages) {
      const missing = requiredKeys(pkg).filter((k) => pkg.locales[lang][k] == null && !/^archetypes\.title$/.test(k));
      expect(missing, lang).toEqual([]);
    }
  });

  it('evaluates every derived value on a blank character without errors', () => {
    const ch = newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, 'x');
    const scope = createScope(pkg.model, ch.values);
    for (const name of Object.keys(pkg.model.derived)) expect(() => scope.derived(name), name).not.toThrow();
    expect(() => evaluateCreation(pkg, ch)).not.toThrow();
  });

  it('references only existing derived values, fields and groups in the sheet', () => {
    const m = pkg.model;
    for (const sec of pkg.sheet.sections) for (const b of flat(sec.blocks as Block[])) {
      if (b.group) expect(m.groups[b.group as string], `group ${b.group}`).toBeDefined();
      if (b.field) expect(m.fields[b.field as string], `field ${b.field}`).toBeDefined();
      if (b.type === 'stepper') expect(m.derived[b.derived as string]).toBeDefined();
      if (b.type === 'stats') for (const i of b.items as string[]) expect(m.fields[i] ?? m.derived[i], `stat ${i}`).toBeDefined();
      for (const tpl of ([] as string[]).concat((b.derived as string | string[] | undefined) ?? []).filter(() => b.group)) {
        for (const it of m.groups[b.group as string].items) expect(m.derived[tpl.replace(/^\+/, '').replace('{id}', it.id)], tpl).toBeDefined();
      }
    }
  });
});
