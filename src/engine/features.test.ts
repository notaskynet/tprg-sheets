import { describe, expect, it } from 'vitest';
import { loadPackage, PackageError, type Files } from './loader';
import { createScope } from './expr/eval';
import { evaluateCreation } from './creation';
import { newCharacter, setValue } from './character';

const files: Files = {
  'system.toml': `id = "t"\nversion = "1.0.0"\nlanguages = ["en"]\nname = { en = "T" }\n[dice]\nmechanic = "notation"\n`,
  'model.toml': `
[groups.skills]
field = { type = "checkbox" }
granted = "concat(lookup('classes', profile.class, 'saves'), lookup('races', profile.race, 'skills'))"
items = [{ id = "a" }, { id = "b" }, { id = "c" }, { id = "d" }]
[catalogs.classes]
items = [
  { id = "fighter", saves = ["a"], pick = ["b", "c"], features = { "1" = ["x"], "3" = ["y", "z"], "5" = ["w"] } },
  { id = "mage", saves = [], pick = ["c", "d"] },
]
[catalogs.races]
items = [{ id = "elf", skills = ["d"], subraces = ["high"] }, { id = "human" }]
[fields]
"profile.class" = { type = "select", from = "classes" }
"profile.race" = { type = "select", from = "races" }
"profile.sub" = { type = "select", from = "races", scope = "lookup('races', profile.race, 'subraces')" }
level = { type = "number", min = 1, default = 1 }
[derived]
feats = "upto(lookup('classes', profile.class, 'features'), level)"
nfeats = "count(feats)"
isElf = "has(concat('elf', 'x'), profile.race)"
total = "sum(skills)"
`,
  'creation.toml': `
[[steps]]
id = "pickSkills"
kind = "spend"
group = "skills"
budget = 1
scope = "lookup('classes', profile.class, 'pick')"
[[steps]]
id = "late"
kind = "fields"
fields = ["profile.sub"]
when = "level >= 3"
`,
  'sheet.toml': `[[sections]]\nid = "s"\nwhen = "level >= 2"\n`,
  'locales/en.toml': ``,
};
const pkg = loadPackage(files);
const mk = (cls: string, race = 'human', level = 1) => {
  let ch = newCharacter(pkg.model, { id: 't', version: '1.0.0' }, 'x');
  ch = setValue(ch, 'profile.class', cls);
  ch = setValue(ch, 'profile.race', race);
  return setValue(ch, 'level', level);
};

describe('catalog list helpers', () => {
  it('upto returns features of every level reached; has/concat work on lists', () => {
    const at = (level: number) => createScope(pkg.model, mk('fighter', 'human', level).values);
    expect(at(1).derived('feats')).toEqual(['x']);
    expect(at(4).derived('feats')).toEqual(['x', 'y', 'z']);
    expect(at(5).derived('nfeats')).toBe(4);
    expect(createScope(pkg.model, mk('mage').values).derived('feats')).toEqual([]);
    expect(createScope(pkg.model, mk('mage', 'elf').values).derived('isElf')).toBe(true);
  });
});

describe('granted items', () => {
  it('read as ticked, count in sums, and are not charged by a spend step', () => {
    const ch = mk('fighter', 'elf');
    const s = createScope(pkg.model, ch.values);
    expect(s.get(['skills', 'a'])).toBe(true); // from the class
    expect(s.get(['skills', 'd'])).toBe(true); // from the race
    expect(s.derived('total')).toBe(2);
    const st = evaluateCreation(pkg, setValue(ch, 'skills.b', true)).steps.find((x) => x.id === 'pickSkills')!;
    expect(st).toMatchObject({ spent: 1, overflow: 0, ok: true });
  });
});

describe('scope and when', () => {
  it('a spend step flags ticks outside its scope and does not count them', () => {
    const bad = setValue(mk('fighter'), 'skills.d', true); // d is not in fighter's list
    const st = evaluateCreation(pkg, bad).steps.find((x) => x.id === 'pickSkills')!;
    expect(st).toMatchObject({ ok: false, spent: 0, invalid: ['d'] });
  });
  it('steps with a false `when` leave the report', () => {
    const ids = (lvl: number) => evaluateCreation(pkg, mk('fighter', 'human', lvl)).steps.map((s) => s.id);
    expect(ids(1)).toEqual(['pickSkills']);
    expect(ids(3)).toEqual(['pickSkills', 'late']);
  });
  it('loading rejects broken new expressions', () => {
    const broken = { ...files, 'creation.toml': files['creation.toml'] + `\n[[steps]]\nid = "x"\nkind = "recap"\nwhen = "1 +"\n` };
    expect(() => loadPackage(broken)).toThrow(PackageError);
  });
});
