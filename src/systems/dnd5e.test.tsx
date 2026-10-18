import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILTIN_PACKAGES } from './builtin';
import { newCharacter, setValue, type Character } from '@/engine/character';
import { createScope } from '@/engine/expr/eval';
import { evaluateCreation } from '@/engine/creation';
import { roll } from '@/engine/dice';
import { I18nProvider } from '@/i18n/I18nContext';
import { SystemProvider } from '@/ui/context';
import { DiceProvider } from '@/ui/dice/DiceProvider';
import { SheetRenderer } from '@/ui/sheet/SheetRenderer';
import { Wizard } from '@/ui/wizard/Wizard';

const pkg = BUILTIN_PACKAGES.find((p) => p.manifest.id === 'dnd5e-srd')!;
const blank = (): Character => newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, 't');
const set = (ch: Character, e: Record<string, unknown>) => Object.entries(e).reduce((c, [k, v]) => setValue(c, k, v), ch);
const d = (ch: Character, n: string) => createScope(pkg.model, ch.values).derived(n);

describe('D&D 5e package: derived values', () => {
  it('ability modifiers include racial bonuses', () => {
    const ch = set(blank(), { 'profile.race': 'dwarf', 'abilities.con': 13, 'abilities.str': 8 });
    expect(d(ch, 'con_score')).toBe(15);
    expect(d(ch, 'con_mod')).toBe(2);
    expect(d(ch, 'str_mod')).toBe(-1);
    expect(d(ch, 'speed')).toBe(25);
    expect(d(set(blank(), { 'profile.race': 'human', 'abilities.dex': 15 }), 'dex_mod')).toBe(3); // 16
  });
  it('proficiency bonus follows level', () => {
    const at = (level: number) => d(set(blank(), { level }), 'proficiency');
    expect([1, 4, 5, 8, 9, 13, 17, 20].map(at)).toEqual([2, 2, 3, 3, 4, 5, 6, 6]);
  });
  it('skills and saves add proficiency only when ticked', () => {
    const ch = set(blank(), { level: 5, 'abilities.dex': 14, 'abilities.wis': 12, 'skills.stealth': true, 'saves.dex': true });
    expect(d(ch, 'skill_stealth')).toBe(2 + 3); // dex mod 2 + prof 3
    expect(d(ch, 'skill_acrobatics')).toBe(2);
    expect(d(ch, 'save_dex')).toBe(5);
    expect(d(ch, 'save_wis')).toBe(1);
    expect(d(ch, 'passive_perception')).toBe(11);
  });
  it('hit points use the class die, Constitution and level', () => {
    const ch = (cls: string, level: number, con: number) => set(blank(), { 'profile.class': cls, level, 'abilities.con': con });
    expect(d(ch('fighter', 1, 14), 'hpMax')).toBe(12); // 10 + 2
    expect(d(ch('fighter', 3, 14), 'hpMax')).toBe(12 + 2 * (6 + 2)); // 28
    expect(d(ch('wizard', 1, 10), 'hpMax')).toBe(6);
    expect(d(set(ch('wizard', 1, 10), { hpBonus: 4 }), 'hpMax')).toBe(10);
  });
});

describe('D&D 5e package: creation', () => {
  const step = (ch: Character, id: string) => evaluateCreation(pkg, ch).steps.find((s) => s.id === id)!;
  const scores = (v: number[]) => Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a, i) => [`abilities.${a}`, v[i]]));

  it('point buy: the classic 15/14/13/12/10/8 costs exactly 27', () => {
    const ch = set(blank(), scores([15, 14, 13, 12, 10, 8]));
    expect(step(ch, 'abilities')).toMatchObject({ method: 'pointbuy', spent: 27, budget: 27, ok: true, overflow: 0 });
  });
  it('point buy: overspending and out-of-range are flagged', () => {
    expect(step(set(blank(), scores([15, 15, 15, 8, 8, 8])), 'abilities')).toMatchObject({ ok: true, spent: 27 });
    expect(step(set(blank(), scores([15, 15, 15, 10, 8, 8])), 'abilities')).toMatchObject({ ok: false, spent: 29, overflow: 2 });
    expect(step(set(blank(), scores([16, 8, 8, 8, 8, 8])), 'abilities').ok).toBe(false);
  });
  it('standard array: each value exactly once', () => {
    const ch = (v: number[]) => ({ ...set(blank(), scores(v)), creation: { step: 0, done: false, methods: { abilities: 'array' } } });
    expect(step(ch([15, 14, 13, 12, 10, 8]), 'abilities')).toMatchObject({ method: 'array', ok: true });
    expect(step(ch([15, 15, 13, 12, 10, 8]), 'abilities').ok).toBe(false);
  });
  it('class decides how many skills you pick', () => {
    const ch = set(blank(), { 'profile.class': 'rogue', 'skills.stealth': true, 'skills.acrobatics': true });
    expect(step(ch, 'skills')).toMatchObject({ budget: 4, spent: 2, ok: false });
    const full = set(ch, { 'skills.perception': true, 'skills.deception': true });
    expect(step(full, 'skills')).toMatchObject({ ok: true, spent: 4 });
  });
});

describe('D&D 5e package: dice and rendering', () => {
  it('rolls d20 + modifier against a DC', () => {
    const r = roll(pkg.manifest.dice, { modifier: 5, difficulty: 15 }, () => 0.5); // natural 11
    expect(r).toMatchObject({ result: 16, kind: 'success' });
  });
  const wrap = (node: React.ReactNode) => renderToString(<I18nProvider><SystemProvider pkg={pkg}>{node}</SystemProvider></I18nProvider>);
  it('renders the sheet', () => {
    const ch = set(blank(), { 'profile.race': 'elf', 'profile.class': 'fighter', 'skills.stealth': true });
    const html = wrap(<DiceProvider values={ch.values}><SheetRenderer values={ch.values} set={() => {}} /></DiceProvider>);
    expect(html).toContain('Характеристики'); // default UI language is ru
    expect(html).toContain('Акробатика');
    expect(html).not.toContain('unknown block');
  });
  it('renders every wizard step', () => {
    pkg.creation.steps.forEach((s, i) => {
      const ch = { ...blank(), creation: { step: i, done: false } };
      const html = wrap(<Wizard ch={ch} set={() => {}} onStep={() => {}} onMethod={() => {}} onFinish={() => {}} onExit={() => {}} />);
      expect(html, s.id).toContain(pkg.locales.ru[`steps.${s.id}`]);
    });
  });
});
