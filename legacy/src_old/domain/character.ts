// Generic VtM character model. All supported systems are *versions of VtM*
// (V20, Dark Ages, Revised, …), so they share this shape and differ only in
// catalogs, rules and creation budgets — which live in the GameSystem plugin.

export interface TraitItem {
  id: string;
  name: string;
  level: number;
}

export interface NotedItem extends TraitItem {
  note: string;
}

export interface CharacterProfile {
  name: string;
  player: string;
  chronicle: string;
  nature: string;
  demeanor: string;
  concept: string;
  clan: string; // clan id from system.clans
  generation: number;
  sire: string;
}

export interface HealthState {
  bashing: number;
  lethal: number;
  aggravated: number;
}

export interface Character {
  id: string; // uuid — stable per character (multi-character support)
  systemId: string; // which GameSystem this character belongs to
  version: number; // schema version for migrations
  updatedAt: number; // epoch ms, for dashboard "last visit" / sync conflict

  profile: CharacterProfile;
  attributes: Record<string, number>; // attributeId -> 1..5
  abilities: Record<string, number>; // abilityId -> 0..5
  specialties: Record<string, string>; // abilityId -> free text
  disciplines: TraitItem[];
  backgrounds: TraitItem[];
  merits: NotedItem[];
  flaws: NotedItem[];
  virtues: Record<string, number>; // virtueId -> 1..5
  willpowerCurrent: number;
  willpowerPermanent: number;
  humanity: number;
  health: HealthState;
  blood: number;
  experience: { total: number; spent: number };
  weakness: string;
  notes: string;
}

/** Lightweight record for the dashboard / character index — no full sheet payload. */
export interface CharacterSummary {
  id: string;
  systemId: string;
  name: string;
  clan: string;
  generation: number;
  concept: string;
  updatedAt: number;
}

export function summarize(ch: Character): CharacterSummary {
  return {
    id: ch.id,
    systemId: ch.systemId,
    name: ch.profile.name,
    clan: ch.profile.clan,
    generation: ch.profile.generation,
    concept: ch.profile.concept,
    updatedAt: ch.updatedAt,
  };
}
