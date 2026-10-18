// Multi-character storage. Layout:
//   v20.characters.index       -> CharacterSummary[]   (dashboard list)
//   v20.characters.<id>        -> Character            (full sheet)
//   v20.session.currentId      -> string               (last opened)
// Migrates the prototype's single `v20.character` doc on first load.
import type { Character, CharacterSummary } from '@/domain/character';
import { summarize } from '@/domain/character';
import { getSystem, DEFAULT_SYSTEM_ID } from '@/systems';
import { key, readJSON, writeJSON, remove, readString } from './storage';

const INDEX_KEY = key('characters', 'index');
const CURRENT_KEY = key('session', 'currentId');
const LEGACY_KEY = key('character'); // prototype single-character doc
const SYNCED_KEY = key('synced'); // ids known to exist in the cloud (for safe delete reconcile)

// "Synced" set: ids we've confirmed in Firestore (pushed or pulled). Used so the
// list reconcile can remove characters deleted on another device WITHOUT wiping
// freshly-created local-only characters that simply haven't been pushed yet.
export function isSynced(id: string): boolean {
  return readJSON<string[]>(SYNCED_KEY, []).includes(id);
}
export function markSynced(id: string): void {
  const s = readJSON<string[]>(SYNCED_KEY, []);
  if (!s.includes(id)) writeJSON(SYNCED_KEY, [...s, id]);
}
export function unmarkSynced(id: string): void {
  writeJSON(SYNCED_KEY, readJSON<string[]>(SYNCED_KEY, []).filter((x) => x !== id));
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'c-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Fill any missing fields from the system default so older docs stay valid. */
function hydrate(raw: Partial<Character>): Character {
  const systemId = raw.systemId || DEFAULT_SYSTEM_ID;
  const base = getSystem(systemId).defaultCharacter();
  return {
    ...base,
    ...raw,
    systemId,
    id: raw.id || uuid(),
    profile: { ...base.profile, ...raw.profile },
    attributes: { ...base.attributes, ...raw.attributes },
    abilities: { ...base.abilities, ...raw.abilities },
    virtues: { ...base.virtues, ...raw.virtues },
    health: { ...base.health, ...raw.health },
    experience: { ...base.experience, ...raw.experience },
  };
}

export function listCharacters(): CharacterSummary[] {
  return readJSON<CharacterSummary[]>(INDEX_KEY, []);
}

function writeIndex(index: CharacterSummary[]): void {
  writeJSON(INDEX_KEY, index);
}

export function loadCharacter(id: string): Character | null {
  const raw = readJSON<Partial<Character> | null>(key('characters', id), null);
  return raw ? hydrate(raw) : null;
}

/** Write a character to local storage as-is (preserves updatedAt). */
export function putCharacter(ch: Character): void {
  writeJSON(key('characters', ch.id), ch);
  const index = listCharacters().filter((c) => c.id !== ch.id);
  index.unshift(summarize(ch));
  writeIndex(index);
}

/** Local edit: stamp a fresh updatedAt, then persist. */
export function saveCharacter(ch: Character): void {
  putCharacter({ ...ch, updatedAt: Date.now() });
}

export function createCharacter(systemId = DEFAULT_SYSTEM_ID): Character {
  const ch = hydrate({ ...getSystem(systemId).defaultCharacter(), id: uuid(), systemId });
  saveCharacter(ch);
  setCurrentId(ch.id);
  return ch;
}

export function deleteCharacter(id: string): void {
  remove(key('characters', id));
  writeIndex(listCharacters().filter((c) => c.id !== id));
  unmarkSynced(id);
  if (getCurrentId() === id) remove(CURRENT_KEY);
}

export function duplicateCharacter(id: string): Character | null {
  const src = loadCharacter(id);
  if (!src) return null;
  const copy = hydrate({ ...src, id: uuid() });
  copy.profile = { ...copy.profile, name: copy.profile.name ? `${copy.profile.name} (copy)` : '' };
  saveCharacter(copy);
  return copy;
}

// Wizard is meant only for a freshly-created character. We flag the new id in
// sessionStorage (cleared on first read) so an already-built sheet never
// auto-opens the wizard — even after a reload.
const OPEN_WIZARD_KEY = 'v20.session.openWizard';

/** localStorage key for a character's persisted wizard step (per-character). */
export function wizardStepKey(id: string): string {
  return key('wizard', id, 'step');
}

export function markOpenWizard(id: string): void {
  try {
    sessionStorage.setItem(OPEN_WIZARD_KEY, id);
  } catch {
    /* ignore */
  }
  remove(wizardStepKey(id)); // start a new character's wizard from step 1
}

export function consumeOpenWizard(id: string): boolean {
  try {
    if (sessionStorage.getItem(OPEN_WIZARD_KEY) === id) {
      sessionStorage.removeItem(OPEN_WIZARD_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function getCurrentId(): string | null {
  return readString(CURRENT_KEY);
}

export function setCurrentId(id: string): void {
  writeJSON(CURRENT_KEY, id);
}

/** One-time migration of the prototype's single character into the index. */
export function migrateLegacy(): void {
  const legacy = readJSON<Partial<Character> | null>(LEGACY_KEY, null);
  if (!legacy || listCharacters().length > 0) return;
  const ch = hydrate({ ...legacy, id: uuid(), systemId: legacy.systemId || DEFAULT_SYSTEM_ID });
  saveCharacter(ch);
  setCurrentId(ch.id);
  remove(LEGACY_KEY);
}
