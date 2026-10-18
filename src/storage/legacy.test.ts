import { describe, expect, it } from 'vitest';
import { BUILTIN_PACKAGES } from '@/systems/builtin';
import { createScope } from '@/engine/expr/eval';
import { convertLegacyV20, readLegacyCharacters } from './legacy';

const pkg = BUILTIN_PACKAGES.find((p) => p.manifest.id === 'vtm-v20')!;

// Shape of a document saved by the pre-rework app.
const old = {
  id: 'abc', systemId: 'vtm-v20', version: 2, updatedAt: 1700000000000,
  profile: { name: 'Нокс', player: 'Даня', chronicle: 'Мск', nature: 'Хитрец', demeanor: 'Судья', concept: 'Фиксер', clan: 'ventrue', generation: 12, sire: 'X' },
  attributes: { strength: 3, wits: 4 },
  abilities: { brawl: 2 },
  specialties: { brawl: 'Боксёр' },
  disciplines: [{ id: 'd1', name: 'Dominate', level: 2 }],
  backgrounds: [{ id: 'b1', name: 'Resources', level: 3 }],
  merits: [{ id: 'm1', name: 'Eidetic', level: 1, note: 'n' }],
  flaws: [],
  virtues: { conscience: 3, selfControl: 2, courage: 4 },
  willpowerCurrent: 3, willpowerPermanent: 6, humanity: 2,
  health: { bashing: 1, lethal: 0, aggravated: 0 }, blood: 5,
  experience: { total: 10, spent: 4 }, weakness: 'w', notes: 'zzz',
};

describe('legacy migration', () => {
  it('maps a V20 sheet onto the package value tree', () => {
    const ch = convertLegacyV20(old, pkg);
    expect(ch).toMatchObject({ id: 'abc', updatedAt: 1700000000000, system: { id: 'vtm-v20' } });
    const v = ch.values as any;
    expect(v.profile).toMatchObject({ name: 'Нокс', clan: 'ventrue', generation: 12 });
    expect(v.attributes).toMatchObject({ strength: 3, wits: 4, stamina: 1 }); // missing → default
    expect(v.specialties.brawl).toBe('Боксёр');
    expect(v.disciplines).toEqual([{ id: 'd1', name: 'Dominate', level: 2 }]);
    expect(v.merits[0]).toMatchObject({ note: 'n' });
    const s = createScope(pkg.model, ch.values);
    expect(s.derived('humanity')).toBe(5); // virtues, stale stored value ignored
    expect(s.derived('willpower')).toBe(6); // courage 4 + bonus 2 (old permanent 6)
    expect(s.derived('bloodMax')).toBe(11); // generation 12
  });

  it('reads the index + per-character keys from localStorage', () => {
    const store: Record<string, string> = {
      'v20.characters.index': JSON.stringify([{ id: 'abc' }]),
      'v20.characters.abc': JSON.stringify(old),
    };
    const out = readLegacyCharacters(pkg, { getItem: (k) => store[k] ?? null });
    expect(out.map((c) => c.id)).toEqual(['abc']);
  });
});
