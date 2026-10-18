// V20 creation wizard steps, in order. The generic Wizard component renders each
// step by its `kind`, pulling budgets/catalogs from the system at runtime.
import type { WizardStep } from '@/systems/types';

export const WIZARD_STEPS: WizardStep[] = [
  { id: 'concept', kind: 'concept', titleKey: 'concept' },
  { id: 'clan', kind: 'clanGeneration', titleKey: 'clan' },
  { id: 'attributes', kind: 'attributes', titleKey: 'attributes' },
  { id: 'abilities', kind: 'abilities', titleKey: 'abilities' },
  { id: 'disciplines', kind: 'disciplines', titleKey: 'disciplines' },
  { id: 'backgrounds', kind: 'backgrounds', titleKey: 'backgrounds' },
  { id: 'virtues', kind: 'virtues', titleKey: 'virtues' },
  { id: 'freebies', kind: 'freebies', titleKey: 'experience' },
  { id: 'recap', kind: 'recap', titleKey: 'checklist' },
];
