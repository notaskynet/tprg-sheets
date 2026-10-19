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

const pkg = BUILTIN_PACKAGES.find((p) => p.manifest.id === 'city-of-mist')!;
const blank = (): Character => newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, 't');
const set = (ch: Character, e: Record<string, unknown>) => Object.entries(e).reduce((c, [k, v]) => setValue(c, k, v), ch);
const d = (ch: Character, n: string) => createScope(pkg.model, ch.values).derived(n);
const row = (level: number) => ({ id: String(level), name: 's', level });

describe('City of Mist package', () => {
  it('counts Mythos and Logos themes', () => {
    const ch = set(blank(), { 't1.kind': 'mythos', 't2.kind': 'logos', 't3.kind': 'logos', 't4.kind': 'mythos' });
    expect([d(ch, 'mythosCount'), d(ch, 'logosCount')]).toEqual([2, 2]);
  });

  it('the best helpful status adds and the worst harmful one subtracts', () => {
    const ch = set(blank(), { 'statuses.pos': [row(1), row(3)], 'statuses.neg': [row(2), row(4), row(1)] });
    expect(d(ch, 'status_mod')).toBe(3 - 4);
    expect(d(blank(), 'status_mod')).toBe(0);
  });

  it('2d6 plus Power falls into bands', () => {
    const cfg = pkg.manifest.dice;
    const mid = () => 0.5; // every d6 is a 4
    expect(roll(cfg, { modifier: 3 }, mid)).toMatchObject({ result: 11, band: 'strong', kind: 'success' });
    expect(roll(cfg, { modifier: 0 }, mid)).toMatchObject({ result: 8, band: 'weak' });
    expect(roll(cfg, { modifier: -3 }, mid)).toMatchObject({ result: 5, band: 'miss', kind: 'failure' });
    expect(roll(cfg, { modifier: 4 }, mid).band).toBe('extreme');
  });

  it('a hero needs name, kind, question, three power tags and a weakness per theme', () => {
    const step = (ch: Character, id: string) => evaluateCreation(pkg, ch).steps.find((s) => s.id === id)!;
    expect(step(blank(), 'theme1').ok).toBe(false);
    const full = set(blank(), { 't1.kind': 'mythos', 't1.name': 'Lisa', 't1.question': 'Why?', 't1.power1': 'a', 't1.power2': 'b', 't1.power3': 'c', 't1.weak1': 'w' });
    expect(step(full, 'theme1').ok).toBe(true);
  });

  it('the sheet renders in Russian with the moves cheat sheet', () => {
    const ch = set(blank(), { 't1.kind': 'mythos', 't1.power1': 'Чёрный антиквар' });
    const html = renderToString(<I18nProvider><SystemProvider pkg={pkg}><DiceProvider values={ch.values}><SheetRenderer values={ch.values} set={() => {}} /></DiceProvider></SystemProvider></I18nProvider>);
    expect(html).toContain('Теги силы');
    expect(html).toContain('Расследовать');
    expect(html).toContain('Чёрный антиквар');
    expect(html).not.toContain('unknown block');
  });
});
