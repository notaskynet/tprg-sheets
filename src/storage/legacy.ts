// One-time import of characters saved by the pre-rework app (localStorage,
// namespace "v20.") into the vtm-v20 package's value tree.
import { hydrateValues, newCharacter, type Character } from '@/engine/character';
import type { SystemPackage } from '@/engine/schema';

type Old = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const rows = (a: unknown) =>
  Array.isArray(a) ? a.map((r: Old) => ({ id: r.id || crypto.randomUUID(), name: r.name ?? '', level: r.level ?? 0, ...(r.note != null ? { note: r.note } : {}) })) : [];

export function convertLegacyV20(old: Old, pkg: SystemPackage): Character {
  const virtues = { conscience: 1, selfControl: 1, courage: 1, ...old.virtues };
  const humanityBase = virtues.conscience + virtues.selfControl;
  const raw = {
    profile: { ...old.profile },
    attributes: old.attributes,
    abilities: old.abilities,
    virtues,
    specialties: old.specialties ?? {},
    disciplines: rows(old.disciplines),
    backgrounds: rows(old.backgrounds),
    merits: rows(old.merits),
    flaws: rows(old.flaws),
    weakness: old.weakness ?? '',
    notes: old.notes ?? '',
    health: old.health,
    blood: old.blood ?? 0,
    humanityBonus: Math.max(0, (old.humanity ?? 0) - humanityBase),
    willpowerBonus: (old.willpowerPermanent ?? virtues.courage) - virtues.courage,
    willpowerCurrent: old.willpowerCurrent ?? 1,
    experience: old.experience,
  };
  const base = newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, old.id || crypto.randomUUID());
  return {
    ...base,
    updatedAt: old.updatedAt ?? Date.now(),
    values: hydrateValues(pkg.model, raw),
    creation: { step: 0, done: true },
  };
}

/** Reads every old character from localStorage; returns converted copies. */
export function readLegacyCharacters(pkg: SystemPackage, ls: Pick<Storage, 'getItem'> = localStorage): Character[] {
  const read = (k: string): Old | null => {
    try { const r = ls.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; }
  };
  const index = read('v20.characters.index');
  const out: Character[] = [];
  if (Array.isArray(index)) {
    for (const s of index) {
      const old = read(`v20.characters.${s.id}`);
      if (old && (old.systemId ?? 'vtm-v20') === 'vtm-v20') out.push(convertLegacyV20({ ...old, id: old.id ?? s.id }, pkg));
    }
  } else {
    const single = read('v20.character'); // prototype single-character doc
    if (single) out.push(convertLegacyV20(single, pkg));
  }
  return out;
}
