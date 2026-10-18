// The plugin contract. To add a new VtM system, implement GameSystem and
// register it (see systems/registry.ts). Components never reference a concrete
// system — they read the active one via useSystem().

import type { Character } from '@/domain/character';
import type { Lang, LocalizedText } from '@/i18n/lang';

export type { Lang, LocalizedText };

/** A named, localized catalog entry (attribute, ability, clan, discipline…). */
export interface Trait {
  id: string;
  name: LocalizedText; // { ru: '…', en: '…', … }
  cat?: string; // category id (e.g. 'physical', 'talents')
}

/** Nature/Demeanor archetype — no stable id, just a localized label. */
export interface Archetype {
  name: LocalizedText;
}

/** One row of the health track and the dice-pool penalty it imposes. */
export interface HealthLevel {
  id: string;
  penalty: number | null; // null = incapacitated (out of action)
}

export interface RollOptions {
  pool: number;
  difficulty: number;
  specialty?: boolean;
  label?: string;
}

export type RollKind = 'success' | 'failure' | 'botch';

export interface RollResult {
  dice: number[];
  successes: number;
  ones: number;
  net: number;
  result: number; // net successes when kind === 'success', else 0
  kind: RollKind;
}

/** One line of the creation checklist shown in the sheet header / wizard recap. */
export interface CheckItem {
  id: string;
  ok: boolean;
  label: string;
  val?: string | number; // display value (e.g. "10/8/6" or 7)
  need?: string | number; // required value for display
}

/** Kinds of creation steps the generic Wizard knows how to render. */
export type WizardStepKind =
  | 'concept'
  | 'clanGeneration'
  | 'attributes'
  | 'abilities'
  | 'disciplines'
  | 'backgrounds'
  | 'virtues'
  | 'freebies'
  | 'recap';

export interface WizardStep {
  id: string;
  kind: WizardStepKind;
  titleKey: string; // key into system labels
}

export interface SystemRules {
  deriveHumanity(ch: Character): number;
  deriveWillpower(ch: Character): number;
  /** [maxBloodPool, maxSpentPerTurn] for a given generation. */
  bloodPoolFor(generation: number): [number, number];
  /** Total dice-pool penalty from current health damage; null = incapacitated. */
  healthPenalty(ch: Character): number | null;
  validateCharacter(ch: Character, lang: Lang): CheckItem[];
  spentFreebies(ch: Character): number;
}

export interface SystemDice {
  defaultDifficulty: number;
  rollPool(opts: RollOptions): RollResult;
}

export interface GameSystem {
  /** Stable unique id, e.g. 'vtm-v20'. Stored on every Character. */
  id: string;
  name: LocalizedText;

  /** Languages this system ships translations for (informational; UI uses fallbacks). */
  languages: Lang[];

  /** System-specific UI labels (trait categories, field names, dice terms…). */
  labels: Partial<Record<Lang, Record<string, string>>>;

  // Catalogs
  attributes: Trait[];
  attributeCategories: string[]; // ordered category ids
  abilities: Trait[];
  abilityCategories: string[];
  clans: Trait[];
  disciplines: Trait[]; // common/suggested; players may add custom
  /** In-clan discipline ids per clan id. Used to scope creation to clan disciplines. */
  clanDisciplines?: Record<string, string[]>;
  backgrounds: Trait[];
  archetypes: Archetype[];
  healthLevels: HealthLevel[];
  virtues: Trait[]; // conscience, self-control, courage (or path variants)

  /** Creation point budgets — free-form numbers a system's rules interpret. */
  creation: Record<string, number>;

  rules: SystemRules;
  dice: SystemDice;
  wizardSteps: WizardStep[];

  /** Produce an empty character bound to this system (id/uuid filled by caller). */
  defaultCharacter(): Character;
}
