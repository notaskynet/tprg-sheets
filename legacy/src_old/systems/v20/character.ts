// V20 empty-character factory.
import type { Character } from '@/domain/character';
import { ATTRIBUTES, ABILITIES } from './data';

const SCHEMA_VERSION = 2;

function emptyAttributes(): Record<string, number> {
  return Object.fromEntries(ATTRIBUTES.map((a) => [a.id, 1]));
}

function emptyAbilities(): Record<string, number> {
  return Object.fromEntries(ABILITIES.map((a) => [a.id, 0]));
}

export function defaultCharacter(): Character {
  return {
    id: '', // assigned by the store when the character is created
    systemId: 'vtm-v20',
    version: SCHEMA_VERSION,
    updatedAt: Date.now(),
    profile: {
      name: '', player: '', chronicle: '',
      nature: '', demeanor: '', concept: '',
      clan: '', generation: 13, sire: '',
    },
    attributes: emptyAttributes(),
    abilities: emptyAbilities(),
    specialties: {},
    disciplines: [],
    backgrounds: [],
    merits: [],
    flaws: [],
    virtues: { conscience: 1, selfControl: 1, courage: 1 },
    willpowerCurrent: 1,
    willpowerPermanent: 1,
    humanity: 2,
    health: { bashing: 0, lethal: 0, aggravated: 0 },
    blood: 0,
    experience: { total: 0, spent: 0 },
    weakness: '',
    notes: '',
  };
}
