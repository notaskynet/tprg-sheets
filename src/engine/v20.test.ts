// Parity with the pre-rework TypeScript V20 plugin (legacy/src_old/systems/v20/v20.test.ts):
// same characters, same expectations, now driven by systems/vtm-v20/*.toml.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPackage, type Files } from './loader';
import { createScope } from './expr/eval';
import { newCharacter, setValue, type Character } from './character';
import { evaluateCreation } from './creation';
import { roll } from './dice';

function readDir(dir: string, prefix = '', out: Files = {}): Files {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) readDir(p, `${prefix}${name}/`, out);
    else if (name.endsWith('.toml')) out[prefix + name] = readFileSync(p, 'utf8');
  }
  return out;
}

const pkg = loadPackage(readDir(join(__dirname, '../../systems/vtm-v20')));
const blank = () => newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, 't');
const derived = (ch: Character, name: string) => createScope(pkg.model, ch.values).derived(name);

function set(ch: Character, entries: Record<string, unknown>) {
  return Object.entries(entries).reduce((c, [k, v]) => setValue(c, k, v), ch);
}

function budgeted(): Character {
  let ch = blank();
  ch = set(ch, {
    // attributes 7/5/3 over base 1
    'attributes.strength': 5, 'attributes.dexterity': 4, 'attributes.stamina': 1,
    'attributes.charisma': 4, 'attributes.manipulation': 3, 'attributes.appearance': 1,
    'attributes.perception': 3, 'attributes.intelligence': 2, 'attributes.wits': 1,
    // abilities 13/9/5
    'abilities.alertness': 3, 'abilities.athletics': 3, 'abilities.brawl': 3, 'abilities.empathy': 3, 'abilities.subterfuge': 1,
    'abilities.drive': 3, 'abilities.firearms': 3, 'abilities.stealth': 3,
    'abilities.occult': 3, 'abilities.academics': 2,
    disciplines: [{ id: 'potence', name: 'Potence', level: 3 }],
    backgrounds: [{ id: 'resources', name: 'Resources', level: 5 }],
    'virtues.conscience': 3, 'virtues.selfControl': 3, 'virtues.courage': 4,
    'profile.name': 'Test', 'profile.clan': 'brujah', 'profile.concept': 'Tester',
  });
  return ch;
}

describe('V20 package', () => {
  it('loads with both locales', () => {
    expect(Object.keys(pkg.locales).sort()).toEqual(['en', 'ru']);
    expect(pkg.locales.en['clans.brujah']).toBe('Brujah');
    expect(pkg.locales.ru['attributes.cat.physical']).toBe('Физические');
    expect(pkg.model.groups.attributes.items).toHaveLength(9);
    expect(pkg.model.groups.abilities.items).toHaveLength(30);
  });

  it('every label key a step/field/item needs exists in every locale', () => {
    const keys: string[] = [];
    for (const [gid, g] of Object.entries(pkg.model.groups)) {
      keys.push(`${gid}.title`, ...g.categories.map((c) => `${gid}.cat.${c}`));
      if (!g.itemsFrom) keys.push(...g.items.map((i) => `${gid}.${i.id}`));
    }
    for (const [cid, c] of Object.entries(pkg.model.catalogs)) keys.push(...c.items.map((i) => `${cid}.${i.id}`));
    keys.push(...Object.keys(pkg.model.fields).map((f) => `fields.${f}`));
    for (const f of Object.values(pkg.model.fields)) if (f.type === 'damage-track') keys.push(...f.levels.map((l) => `levels.${l}`), ...f.kinds.map((k) => `damage.${k}`));
    keys.push(...pkg.creation.steps.flatMap((s) => [`steps.${s.id}`, `hints.${s.id}`, `guide.${s.id}`]));
    // a one-line description for every option the user picks from, and help for every wizard form field
    for (const [cid, c] of Object.entries(pkg.model.catalogs)) keys.push(...c.items.map((i) => `desc.${cid}.${i.id}`));
    for (const s of pkg.creation.steps) {
      if (s.kind === 'fields') keys.push(...s.fields.map((f) => `help.${f}`));
      if (s.kind === 'pick') keys.push(`help.${s.field}`, ...s.fields.map((f) => `help.${f}`));
    }
    for (const lang of pkg.manifest.languages) {
      const missing = keys.filter((k) => k !== 'archetypes.title' && pkg.locales[lang][k] == null);
      expect(missing, lang).toEqual([]);
    }
  });
});

describe('V20 derived values', () => {
  it('humanity = conscience + self-control; willpower = courage', () => {
    const ch = set(blank(), { 'virtues.conscience': 3, 'virtues.selfControl': 2, 'virtues.courage': 4 });
    expect(derived(ch, 'humanity')).toBe(5);
    expect(derived(ch, 'willpower')).toBe(4);
  });

  it('health penalty follows the V20 track', () => {
    const ch = blank();
    expect(derived(ch, 'healthPenalty')).toBe(0);
    expect(derived(set(ch, { health: { bashing: 1, lethal: 0, aggravated: 0 } }), 'healthPenalty')).toBe(0); // bruised
    expect(derived(set(ch, { health: { bashing: 0, lethal: 4, aggravated: 0 } }), 'healthPenalty')).toBe(-2); // wounded
    const dead = set(ch, { health: { bashing: 0, lethal: 0, aggravated: 8 } });
    expect(derived(dead, 'incapacitated')).toBe(true);
    expect(derived(set(ch, { health: { bashing: 6, lethal: 0, aggravated: 0 } }), 'incapacitated')).toBe(false);
  });

  it('blood pool by generation', () => {
    const ch = (g: number) => set(blank(), { 'profile.generation': g });
    expect([derived(ch(13), 'bloodMax'), derived(ch(13), 'bloodPerTurn')]).toEqual([10, 1]);
    expect([derived(ch(9), 'bloodMax'), derived(ch(9), 'bloodPerTurn')]).toEqual([14, 2]);
    expect([derived(ch(4), 'bloodMax'), derived(ch(4), 'bloodPerTurn')]).toEqual([50, 10]);
  });
});

describe('V20 creation', () => {
  it('a freshly-budgeted character spends 0 freebies and validates', () => {
    const rep = evaluateCreation(pkg, budgeted());
    expect(rep.freebies).toEqual({ spent: 0, budget: 15 });
    expect(rep.checklist.filter((c) => !c.ok).map((c) => c.id)).toEqual([]);
    expect(rep.steps.find((s) => s.id === 'attributes')!.ranks!.map((r) => r.spent)).toEqual([7, 5, 3]);
    expect(rep.steps.find((s) => s.id === 'abilities')!.capViolations).toEqual([]);
  });

  it('a blank character fails every budget', () => {
    const failing = evaluateCreation(pkg, blank()).checklist.filter((c) => !c.ok).map((c) => c.id);
    expect(failing).toEqual(expect.arrayContaining(['profile.name', 'profile.concept', 'profile.clan', 'attributes', 'abilities', 'disciplines', 'backgrounds', 'virtues']));
  });

  it('charges freebies for dots over the caps', () => {
    const over = (patch: Record<string, unknown>) => evaluateCreation(pkg, set(budgeted(), patch)).freebies!.spent;
    expect(over({ disciplines: [{ id: 'potence', name: 'Potence', level: 4 }] })).toBe(7);
    expect(over({ 'attributes.stamina': 2 })).toBe(5);
    expect(over({ 'abilities.law': 1 })).toBe(2); // knowledges 6 > 5
    expect(over({ backgrounds: [{ id: 'resources', name: 'R', level: 7 }] })).toBe(2);
    expect(over({ 'virtues.courage': 5 })).toBe(2);
    expect(over({ humanityBonus: 1, willpowerBonus: 2 })).toBe(4);
  });

  it('flags abilities above 3 dots', () => {
    const rep = evaluateCreation(pkg, set(budgeted(), { 'abilities.alertness': 4 }));
    expect(rep.steps.find((s) => s.id === 'abilities')!.capViolations).toEqual(['alertness']);
  });

  it('clan scopes discipline quick-picks', () => {
    expect(derived(budgeted(), 'humanity')).toBe(6);
    const scope = createScope(pkg.model, budgeted().values);
    expect(scope.run("lookup('clans', profile.clan, 'disciplines')")).toEqual(['celerity', 'potence', 'presence']);
  });
});

describe('V20 dice', () => {
  const seq = (...faces: number[]) => { let i = 0; return () => (faces[i++ % faces.length] - 1) / 10 + 0.0001; };
  it('specialty adds one die; 1s subtract; botch', () => {
    expect(roll(pkg.manifest.dice, { pool: 3, difficulty: 6, specialty: true }, seq(8)).dice).toHaveLength(4);
    expect(roll(pkg.manifest.dice, { pool: 4, difficulty: 6 }, seq(10, 1, 7, 3))).toMatchObject({ successes: 2, ones: 1, result: 1, kind: 'success' });
    expect(roll(pkg.manifest.dice, { pool: 2, difficulty: 6 }, seq(1, 4)).kind).toBe('botch');
  });
});

describe('checklist reasons', () => {
  it('tells what is wrong and which step fixes it', () => {
    const items = evaluateCreation(pkg, blank()).checklist;
    const by = (id: string) => items.find((c) => c.id === id)!;
    expect(by('profile.clan')).toMatchObject({ empty: true, stepId: 'clan' });
    expect(by('attributes')).toMatchObject({ missing: 15, over: 0, stepId: 'attributes' });
    expect(by('disciplines')).toMatchObject({ missing: 3, stepId: 'disciplines' });
    const over = evaluateCreation(pkg, set(budgeted(), { 'attributes.stamina': 2 })).checklist;
    expect(over.find((c) => c.id === 'attributes')).toMatchObject({ over: 1 });
    expect(over.find((c) => c.id === 'freebies')!.ok).toBe(true);
  });
});
