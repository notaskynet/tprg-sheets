// Vampire: The Masquerade — 20th Anniversary Edition, assembled as a GameSystem.
import type { GameSystem } from '@/systems/types';
import { LABELS } from './labels';
import {
  ATTRIBUTES, ABILITIES, ATTRIBUTE_CATEGORIES, ABILITY_CATEGORIES,
  CLANS, COMMON_DISCIPLINES, CLAN_DISCIPLINES, COMMON_BACKGROUNDS, ARCHETYPES,
  HEALTH_LEVELS, VIRTUES, CREATION, bloodPoolFor,
} from './data';
import {
  deriveHumanity, deriveWillpower, healthPenalty, validateCharacter, spentFreebies,
} from './rules';
import { rollPool, DEFAULT_DIFFICULTY } from './dice';
import { defaultCharacter } from './character';
import { WIZARD_STEPS } from './creation';

export const v20System: GameSystem = {
  id: 'vtm-v20',
  name: { ru: 'Маскарад V20', en: 'Masquerade V20' },
  languages: ['ru', 'en'],
  labels: LABELS,

  attributes: ATTRIBUTES,
  attributeCategories: ATTRIBUTE_CATEGORIES,
  abilities: ABILITIES,
  abilityCategories: ABILITY_CATEGORIES,
  clans: CLANS,
  disciplines: COMMON_DISCIPLINES,
  clanDisciplines: CLAN_DISCIPLINES,
  backgrounds: COMMON_BACKGROUNDS,
  archetypes: ARCHETYPES,
  healthLevels: HEALTH_LEVELS,
  virtues: VIRTUES,
  creation: CREATION,

  rules: {
    deriveHumanity,
    deriveWillpower,
    bloodPoolFor,
    healthPenalty,
    validateCharacter,
    spentFreebies,
  },
  dice: {
    defaultDifficulty: DEFAULT_DIFFICULTY,
    rollPool,
  },
  wizardSteps: WIZARD_STEPS,
  defaultCharacter,
};
