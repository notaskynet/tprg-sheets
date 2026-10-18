import { describe, expect, it } from 'vitest';
import { rollPool } from './dice';
import { defaultCharacter } from './character';
import { spentFreebies, validateCharacter, deriveHumanity, deriveWillpower, healthPenalty } from './rules';
import type { Character } from '@/domain/character';

describe('rollPool', () => {
  it('counts successes at or above difficulty, subtracts 1s', () => {
    // Force a deterministic pool by stubbing the dice via repeated rolls is flaky;
    // instead assert invariants over many rolls.
    for (let i = 0; i < 500; i++) {
      const r = rollPool({ pool: 5, difficulty: 6 });
      expect(r.dice).toHaveLength(5);
      expect(r.dice.every((d) => d >= 1 && d <= 10)).toBe(true);
      expect(r.net).toBe(r.successes - r.ones);
      if (r.kind === 'success') expect(r.result).toBe(r.net);
      if (r.kind === 'botch') {
        expect(r.successes).toBe(0);
        expect(r.ones).toBeGreaterThan(0);
      }
    }
  });

  it('empty pool never succeeds', () => {
    const r = rollPool({ pool: 0, difficulty: 6 });
    expect(r.kind).toBe('failure');
    expect(r.dice).toHaveLength(0);
  });
});

describe('derived values', () => {
  it('humanity = conscience + self-control; willpower = courage', () => {
    const ch = defaultCharacter();
    ch.virtues = { conscience: 3, selfControl: 2, courage: 4 };
    expect(deriveHumanity(ch)).toBe(5);
    expect(deriveWillpower(ch)).toBe(4);
  });

  it('health penalty follows V20 track', () => {
    const ch = defaultCharacter();
    expect(healthPenalty(ch)).toBe(0);
    ch.health = { bashing: 1, lethal: 0, aggravated: 0 };
    expect(healthPenalty(ch)).toBe(0); // bruised
    ch.health = { bashing: 0, lethal: 4, aggravated: 0 };
    expect(healthPenalty(ch)).toBe(-2); // wounded
    ch.health = { bashing: 0, lethal: 0, aggravated: 8 };
    expect(healthPenalty(ch)).toBeNull(); // incapacitated
  });
});

function maxedCreationCharacter(): Character {
  const ch = defaultCharacter();
  // Attributes: 7/5/3 over base 1 across triads (physical 7, social 5, mental 3)
  ch.attributes.strength = 5; ch.attributes.dexterity = 4; ch.attributes.stamina = 1; // +7
  ch.attributes.charisma = 4; ch.attributes.manipulation = 3; ch.attributes.appearance = 1; // +5
  ch.attributes.perception = 3; ch.attributes.intelligence = 2; ch.attributes.wits = 1; // +3
  // Abilities: 13/9/5
  ['alertness', 'athletics', 'brawl', 'empathy'].forEach((id) => (ch.abilities[id] = 3));
  ch.abilities.subterfuge = 1; // talents = 13
  ['drive', 'firearms', 'stealth'].forEach((id) => (ch.abilities[id] = 3)); // skills = 9
  ch.abilities.occult = 3; ch.abilities.academics = 2; // knowledges = 5
  ch.disciplines = [{ id: 'potence', name: 'Potence', level: 3 }];
  ch.backgrounds = [{ id: 'resources', name: 'Resources', level: 5 }];
  ch.virtues = { conscience: 3, selfControl: 3, courage: 4 }; // total 10
  ch.profile.name = 'Test';
  ch.profile.clan = 'brujah';
  ch.profile.concept = 'Tester';
  return ch;
}

describe('character creation', () => {
  it('a freshly-budgeted character spends 0 freebies and validates', () => {
    const ch = maxedCreationCharacter();
    expect(spentFreebies(ch)).toBe(0);
    const checks = validateCharacter(ch, 'en');
    const failing = checks.filter((c) => !c.ok).map((c) => c.id);
    expect(failing).toEqual([]);
  });

  it('charges freebies for dots over the caps', () => {
    const ch = maxedCreationCharacter();
    ch.disciplines = [{ id: 'potence', name: 'Potence', level: 4 }]; // +1 over 3 → 7 freebies
    expect(spentFreebies(ch)).toBe(7);
  });
});
