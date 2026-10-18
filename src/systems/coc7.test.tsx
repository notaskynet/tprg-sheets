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

const pkg = BUILTIN_PACKAGES.find((p) => p.manifest.id === 'coc7')!;
const blank = (): Character => newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, 't');
const set = (ch: Character, e: Record<string, unknown>) => Object.entries(e).reduce((c, [k, v]) => setValue(c, k, v), ch);
const d = (ch: Character, n: string) => createScope(pkg.model, ch.values).derived(n);
const stats = (o: Partial<Record<string, number>>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`characteristics.${k}`, v]));

describe('Call of Cthulhu 7e package', () => {
  it('derives hit points, magic points, sanity limits', () => {
    const ch = set(blank(), stats({ con: 60, siz: 65, pow: 55 }));
    expect(d(ch, 'hp_max')).toBe(12);
    expect(d(ch, 'mp_max')).toBe(11);
    expect(d(ch, 'san_max')).toBe(99);
    expect(d(set(ch, { 'skills.cthulhu_mythos': 10 }), 'san_max')).toBe(89);
  });
  it('damage bonus, build and move rate come from STR+SIZ and DEX', () => {
    const at = (str: number, siz: number, dex = 50) => set(blank(), stats({ str, siz, dex }));
    expect([d(at(30, 30), 'db'), d(at(30, 30), 'build')]).toEqual(['-2', -2]);
    expect([d(at(50, 50), 'db'), d(at(50, 50), 'build')]).toEqual(['0', 0]);
    expect([d(at(80, 80), 'db'), d(at(80, 80), 'build')]).toEqual(['+1D4', 1]);
    expect(d(at(40, 60, 40), 'move')).toBe(7); // DEX and STR both below SIZ
    expect(d(at(70, 50, 70), 'move')).toBe(9);
    expect(d(at(50, 50, 50), 'move')).toBe(8);
  });
  it('skill totals are base + added; half and fifth are derived', () => {
    const ch = set(blank(), { ...stats({ dex: 70, edu: 80 }), 'skills.spot_hidden': 15, 'skills.dodge': 10 });
    expect(d(ch, 'skill_spot_hidden')).toBe(40);
    expect(d(ch, 'skill_spot_hidden_half')).toBe(20);
    expect(d(ch, 'skill_spot_hidden_fifth')).toBe(8);
    expect(d(ch, 'skill_dodge')).toBe(35 + 10); // base DEX/2
    expect(d(ch, 'skill_language_own')).toBe(80);
  });
  it('skill points budget is EDU×4 + INT×2', () => {
    const ch = set(blank(), { ...stats({ edu: 70, int: 60 }), 'skills.library_use': 40, 'skills.occult': 40 });
    const sk = evaluateCreation(pkg, ch).steps.find((s) => s.id === 'skills')!;
    expect(sk).toMatchObject({ budget: 400, spent: 80, ok: false });
    expect(evaluateCreation(pkg, set(ch, { 'skills.library_use': 75, 'skills.occult': 75, 'skills.law': 75, 'skills.history': 75, 'skills.psychology': 75, 'skills.listen': 25 })).steps.find((s) => s.id === 'skills')).toMatchObject({ ok: true });
  });
  it('rolls under the skill: regular / hard / extreme', () => {
    const faces = (...f: number[]) => { let i = 0; return () => (f[i++ % f.length] - 1) / 10 + 0.0001; };
    expect(roll(pkg.manifest.dice, { skill: 60 }, faces(5, 2))).toMatchObject({ result: 42, degree: 'regular' }); // 42 ≤ 60
    expect(roll(pkg.manifest.dice, { skill: 60 }, faces(3, 1))).toMatchObject({ result: 21, degree: 'hard' }); // ≤ 30
    expect(roll(pkg.manifest.dice, { skill: 60 }, faces(2, 1))).toMatchObject({ result: 11, degree: 'extreme' }); // ≤ 12
    expect(roll(pkg.manifest.dice, { skill: 60 }, faces(8, 3))).toMatchObject({ result: 73, kind: 'failure' });
  });

  const wrap = (node: React.ReactNode) => renderToString(<I18nProvider><SystemProvider pkg={pkg}>{node}</SystemProvider></I18nProvider>);
  it('renders the sheet and every wizard step', () => {
    const ch = set(blank(), stats({ str: 50, con: 50, siz: 50, dex: 50, pow: 60, edu: 70 }));
    const html = wrap(<DiceProvider values={ch.values}><SheetRenderer values={ch.values} set={() => {}} /></DiceProvider>);
    expect(html).toContain('Характеристики');
    expect(html).toContain('Уклонение');
    expect(html).not.toContain('unknown block');
    pkg.creation.steps.forEach((s, i) => {
      const w = wrap(<Wizard ch={{ ...ch, creation: { step: i, done: false } }} set={() => {}} onStep={() => {}} onMethod={() => {}} onFinish={() => {}} onExit={() => {}} />);
      expect(w, s.id).toContain(pkg.locales.ru[`steps.${s.id}`]);
    });
  });
});
