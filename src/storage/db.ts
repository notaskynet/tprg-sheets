// Local-first persistence: IndexedDB (idb-keyval) behind an in-memory cache that
// UI reads synchronously via useSyncExternalStore. Writes are write-through.
import { createStore, set, del, entries } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import type { Character } from '@/engine/character';
import type { Files } from '@/engine/loader';

const charStore = createStore('trpg-sheets', 'characters');
const pkgStore = createStore('trpg-sheets-packages', 'packages');

let chars = new Map<string, Character>();
let snapshot: Character[] = [];
const listeners = new Set<() => void>();
let ready: Promise<void> | null = null;

function emit() {
  snapshot = [...chars.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  listeners.forEach((l) => l());
}

export function initStorage(): Promise<void> {
  ready ??= entries<string, Character>(charStore)
    .then((rows) => {
      chars = new Map(rows);
      emit();
    })
    .catch(() => emit()); // private mode etc.: run in-memory
  return ready;
}

export const subscribe = (cb: () => void) => (listeners.add(cb), () => void listeners.delete(cb));
export const useCharacters = () => useSyncExternalStore(subscribe, () => snapshot);
export const getCharacter = (id: string) => chars.get(id);

/** Store as-is (keeps updatedAt). */
export function putCharacter(ch: Character): void {
  chars.set(ch.id, ch);
  emit();
  set(ch.id, ch, charStore).catch(() => {});
}

/** Local edit: stamp updatedAt. */
export const saveCharacter = (ch: Character) => putCharacter({ ...ch, updatedAt: Date.now() });

export function deleteCharacter(id: string): void {
  chars.delete(id);
  emit();
  del(id, charStore).catch(() => {});
}

// ---- imported system packages (raw files, re-parsed at startup) ----
export const savePackageFiles = (id: string, files: Files) => set(id, files, pkgStore);
export const deletePackageFiles = (id: string) => del(id, pkgStore);
export async function loadPackageFiles(): Promise<Files[]> {
  try {
    return (await entries<string, Files>(pkgStore)).map(([, f]) => f);
  } catch {
    return [];
  }
}
