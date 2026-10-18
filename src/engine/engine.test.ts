import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { loadPackage, filesFromZip, PackageError, type Files } from './loader';
import { createScope } from './expr/eval';
import { parse } from './expr/parse';
import { roll } from './dice';
import { newCharacter, setValue, hydrateValues } from './character';

const files: Files = {
  'system.toml': `
id = "test"
version = "1.0.0"
languages = ["en"]
name = { en = "Test" }
[dice]
mechanic = "pool-successes"
`,
  'model.toml': `
[groups.attributes]
categories = ["physical", "mental"]
field = { type = "dots", min = 1, max = 5 }
items = [
  { id = "strength", cat = "physical" },
  { id = "stamina", cat = "physical" },
  { id = "wits", cat = "mental" },
]
[catalogs.clans]
items = [{ id = "brujah", disciplines = ["celerity", "potence"] }]
[fields]
"profile.name" = { type = "text" }
"profile.generation" = { type = "number", default = 13 }
health = { type = "damage-track", levels = ["a", "b", "c"] }
[derived]
phys = "sum(attributes.physical)"
all = "sum(attributes)"
bp = "table('blood', profile.generation)[0]"
penalty = "table('pen', sum(health))"
mod = "floor((attributes.strength - 3) / 2)"
big = "if(phys > 3 and not (all == 0), 'yes', 'no')"
[tables.blood]
13 = [10, 1]
9 = [14, 2]
[tables.pen]
0 = 0
2 = -1
3 = -2
`,
  'locales/en.toml': `[attributes]\nstrength = "Strength"`,
};

const pkg = () => loadPackage(files);

describe('expressions', () => {
  it('parses precedence and unary minus', () => {
    const s = createScope(pkg().model, {});
    expect(s.run('1 + 2 * 3')).toBe(7);
    expect(s.run('-(2 + 3) * 2')).toBe(-10);
    expect(s.run('10 % 4 + 7 / 2')).toBe(5.5);
    expect(s.run('min(4, 2, 9) + max(1, 3)')).toBe(5);
  });
  it('rejects garbage', () => {
    expect(() => parse('1 +')).toThrow();
    expect(() => parse('a $ b')).toThrow();
  });
  it('derives from character values (sums, categories, tables)', () => {
    const p = pkg();
    let ch = newCharacter(p.model, { id: 'test', version: '1.0.0' }, 'x');
    ch = setValue(ch, 'attributes.strength', 4);
    ch = setValue(ch, 'attributes.stamina', 2);
    const s = createScope(p.model, ch.values);
    expect(s.derived('phys')).toBe(6);
    expect(s.derived('all')).toBe(7);
    expect(s.derived('bp')).toBe(10);
    expect(s.derived('mod')).toBe(0);
    expect(s.derived('big')).toBe('yes');
  });
  it('table clamps to the nearest lower key and sums damage', () => {
    const p = pkg();
    let ch = newCharacter(p.model, { id: 'test', version: '1.0.0' }, 'x');
    expect(createScope(p.model, ch.values).derived('penalty')).toBe(0);
    ch = setValue(ch, 'health', { bashing: 1, lethal: 1, aggravated: 0 });
    expect(createScope(p.model, ch.values).derived('penalty')).toBe(-1);
    ch = setValue(ch, 'health', { bashing: 1, lethal: 1, aggravated: 5 });
    expect(createScope(p.model, ch.values).derived('penalty')).toBe(-2);
  });
  it('detects derived cycles', () => {
    const p = pkg();
    p.model.derived.a = 'b + 1';
    p.model.derived.b = 'a + 1';
    expect(() => createScope(p.model, {}).derived('a')).toThrow(/cycle/);
  });
});

describe('dice', () => {
  // deterministic RNG: yields the given die faces for a die with `sides` sides
  const seqN = (sides: number) => (...faces: number[]) => { let i = 0; return () => (faces[i++ % faces.length] - 1) / sides + 0.0001; };
  const seq = seqN(10);
  const cfg = pkg().manifest.dice;
  it('pool-successes: ones cancel successes, botch, specialty adds a die', () => {
    expect(roll(cfg, { pool: 3, difficulty: 6 }, seq(8, 1, 6))).toMatchObject({ successes: 2, ones: 1, result: 1, kind: 'success' });
    expect(roll(cfg, { pool: 2, difficulty: 6 }, seq(1, 3))).toMatchObject({ kind: 'botch' });
    expect(roll(cfg, { pool: 2, difficulty: 6, specialty: true }, seq(7)).dice).toHaveLength(3);
    expect(roll(cfg, { pool: 0 }, seq(5))).toMatchObject({ kind: 'failure', dice: [] });
  });
  it('d20-modifier: advantage, crits, DC', () => {
    const c = { mechanic: 'd20-modifier', critSuccess: 20, critFail: 1 } as const;
    expect(roll(c, { modifier: 5, difficulty: 15, advantage: 'adv' }, seqN(20)(3, 12))).toMatchObject({ result: 17, kind: 'success' });
    expect(roll(c, { modifier: 5 }, seqN(20)(20)).kind).toBe('crit');
    expect(roll(c, { modifier: 5 }, seqN(20)(1)).kind).toBe('critfail');
  });
  it('d100-under: degrees of success', () => {
    const c = { mechanic: 'd100-under' } as const;
    // faces: tens die then units die (face 10 = 0)
    expect(roll(c, { skill: 50 }, seq(3, 5))).toMatchObject({ result: 25, degree: 'hard' });
    expect(roll(c, { skill: 50 }, seq(4, 1))).toMatchObject({ result: 31, degree: 'regular' });
    expect(roll(c, { skill: 50 }, seq(1, 5))).toMatchObject({ result: 5, degree: 'extreme' });
    expect(roll(c, { skill: 50 }, seq(8, 6))).toMatchObject({ result: 76, degree: 'fail', kind: 'failure' });
    expect(roll(c, { skill: 50 }, seq(1, 1)).kind).toBe('crit'); // 01
  });
  it('notation', () => {
    expect(roll({ mechanic: 'notation' }, { notation: '2d6+3' }, seqN(6)(2, 5)).result).toBe(10);
  });
});

describe('character + loader', () => {
  it('hydrate fills missing values and keeps unknown ones', () => {
    const p = pkg();
    const v = hydrateValues(p.model, { attributes: { strength: 3 }, legacy: { x: 1 } });
    expect(v).toMatchObject({ attributes: { strength: 3, stamina: 1, wits: 1 }, legacy: { x: 1 }, profile: { generation: 13 } });
  });
  it('loads a zip with a wrapping folder', () => {
    const z = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [`pack/${k}`, strToU8(v)])));
    expect(loadPackage(filesFromZip(z)).manifest.id).toBe('test');
  });
  it('reports precise issues', () => {
    const bad = { ...files, 'model.toml': files['model.toml'] + '\n[derived2]\n', 'creation.toml': `[[steps]]\nid="s"\nkind="priority"\ngroup="nope"\nbudgets=[1]` };
    try {
      loadPackage(bad);
      throw new Error('should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(PackageError);
      expect((e as PackageError).issues.join('\n')).toContain('unknown group "nope"');
    }
  });
});

import { rollNotation } from './dice/notation';
describe('dice notation', () => {
  const faces = (sides: number, ...f: number[]) => { let i = 0; return () => (f[i++ % f.length] - 1) / sides + 0.0001; };
  it('drops and keeps dice', () => {
    expect(rollNotation('4d6dl1', faces(6, 6, 1, 4, 3))).toMatchObject({ total: 13, dice: [6, 1, 4, 3] });
    expect(rollNotation('4d6kh3', faces(6, 6, 1, 4, 3)).total).toBe(13);
    expect(rollNotation('2d20kl1', faces(20, 15, 4)).total).toBe(4);
  });
  it('handles arithmetic like CoC characteristic rolls', () => {
    expect(rollNotation('3d6*5', faces(6, 3, 4, 5)).total).toBe(60);
    expect(rollNotation('(2d6+6)*5', faces(6, 3, 4)).total).toBe(65);
    expect(rollNotation('d20+5', faces(20, 7)).total).toBe(12);
    expect(rollNotation('2d6 - 1', faces(6, 2, 3)).total).toBe(4);
  });
  it('rejects garbage', () => {
    for (const bad of ['', 'abc', '2d', '2d6+', '(2d6']) expect(() => rollNotation(bad, Math.random), bad).toThrow();
  });
});
