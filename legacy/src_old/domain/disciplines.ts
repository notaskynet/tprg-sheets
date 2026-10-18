// Quick-pick discipline names for a character: scoped to the clan's in-clan
// disciplines when the system defines them and a clan is chosen; otherwise the
// full common list (Caitiff, no clan selected, or a system without clan data).
import type { GameSystem } from '@/systems/types';
import type { LocalizedText } from '@/i18n/lang';

export function disciplinePreset(
  system: GameSystem,
  clanId: string,
  name: (t: LocalizedText | undefined) => string,
): string[] {
  const ids = clanId ? system.clanDisciplines?.[clanId] : undefined;
  if (ids && ids.length) {
    return ids.map((id) => name(system.disciplines.find((d) => d.id === id)?.name) || id);
  }
  return system.disciplines.map((d) => name(d.name));
}
