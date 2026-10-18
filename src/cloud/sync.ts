// Keeps local characters and imported systems in step with the signed-in user's Firestore copy.
// Local-first: every edit lands in IndexedDB at once and is pushed in the background; the cloud
// feed is merged back with `reconcile`. Anything we pushed or saw in the cloud is remembered in a
// per-user "synced" set so a deletion on another device can be told apart from a never-uploaded sheet.
import { useSyncExternalStore } from 'react';
import type { Character } from '@/engine/character';
import type { Files } from '@/engine/loader';
import { allCharacters, deleteCharacter, onCharacterChange, putCharacter, type Origin } from '@/storage/db';
import { addPackage, listCustomPackages, onPackageChange, removePackage } from '@/systems/registry';
import { deleteRemote, putRemote, watchRemote, type Collection, type RemoteDoc } from './firebase';
import { reconcile, type Stamped } from './reconcile';
import { startShares } from './shares';

const PUSH_DELAY = 2000;

// ---- status for the UI ----
export type SyncState = 'off' | 'syncing' | 'synced' | 'error';
let state: SyncState = 'off';
let pending = 0;
let failed = false;
const listeners = new Set<() => void>();
function setState(next: SyncState) {
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l());
}
const refresh = () => setState(failed ? 'error' : pending > 0 ? 'syncing' : 'synced');
export const useSyncState = (): SyncState => useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), () => state);

// ---- per-user set of ids known to exist in the cloud ----
const syncedKey = (uid: string, col: Collection) => `trpg.synced.${uid}.${col}`;
function loadSynced(uid: string, col: Collection): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(syncedKey(uid, col)) ?? '[]')); } catch { return new Set(); }
}
function saveSynced(uid: string, col: Collection, ids: Set<string>) {
  try { localStorage.setItem(syncedKey(uid, col), JSON.stringify([...ids])); } catch { /* ignore */ }
}

interface Adapter<T extends Stamped> {
  col: Collection;
  list: () => T[] | Promise<T[]>;
  fromRemote: (doc: RemoteDoc) => T | null;
  payload: (item: T) => unknown;
  apply: (item: T) => void | Promise<void>; // write a cloud item locally (must not echo back)
  remove: (id: string) => void | Promise<void>; // delete locally (must not echo back)
  onLocalChange: (cb: (id: string, item: T | null, origin: Origin) => void) => () => void;
}

interface Handle {
  stop: () => void;
  flush: () => Promise<void>; // push everything still waiting, resolve when in flight pushes are done
  unsynced: () => Promise<number>; // local items the cloud does not have in their current form
}

function syncCollection<T extends Stamped>(uid: string, a: Adapter<T>): Handle {
  const synced = loadSynced(uid, a.col);
  const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; item: T }>();
  const inflight = new Set<Promise<void>>();
  const dirty = new Set<string>(); // pushes that failed (offline) and are not in the cloud yet
  let alive = true;
  let unwatch: (() => void) | undefined;

  const track = (p: Promise<void>) => {
    inflight.add(p);
    void p.finally(() => inflight.delete(p));
  };

  const mark = (id: string, on: boolean) => {
    if (on) synced.add(id); else synced.delete(id);
    saveSynced(uid, a.col, synced);
  };

  async function push(item: T) {
    pending++;
    refresh();
    try {
      await putRemote(uid, a.col, item.id, item.updatedAt, a.payload(item));
      failed = false;
      dirty.delete(item.id);
      mark(item.id, true);
    } catch {
      failed = true;
      dirty.add(item.id);
    } finally {
      pending--;
      refresh();
    }
  }

  async function drop(id: string) {
    pending++;
    refresh();
    try {
      await deleteRemote(uid, a.col, id);
      failed = false;
      mark(id, false);
    } catch {
      failed = true;
    } finally {
      pending--;
      refresh();
    }
  }

  const unlisten = a.onLocalChange((id, item, origin) => {
    if (origin === 'remote') return;
    const queued = timers.get(id);
    if (queued) { clearTimeout(queued.timer); timers.delete(id); pending--; }
    if (!item) { dirty.delete(id); track(drop(id)); return; }
    pending++; // the debounce window counts as "syncing"
    refresh();
    timers.set(id, {
      item,
      timer: setTimeout(() => {
        timers.delete(id);
        pending--;
        track(push(item));
      }, PUSH_DELAY),
    });
  });

  // Send what is still waiting out its debounce (tab hidden or closing, sign-out).
  const flush = async () => {
    for (const { timer, item } of timers.values()) {
      clearTimeout(timer);
      pending--;
      track(push(item));
    }
    timers.clear();
    await Promise.all([...inflight]);
  };
  const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
  document.addEventListener('visibilitychange', onHide);

  void watchRemote(
    uid,
    a.col,
    async (docs, fromCache) => {
      const remote = docs.map(a.fromRemote).filter((x): x is T => x !== null);
      const plan = reconcile(await a.list(), remote, synced, !fromCache);
      if (!alive) return;
      remote.forEach((r) => synced.add(r.id));
      for (const item of plan.toLocal) await a.apply(item);
      for (const id of plan.deleteLocal) { await a.remove(id); synced.delete(id); }
      saveSynced(uid, a.col, synced);
      plan.toRemote.forEach((it) => track(push(it)));
      failed = false;
      refresh();
    },
    () => { failed = true; refresh(); },
  ).then((fn) => { if (alive) unwatch = fn; else fn(); }).catch(() => { failed = true; refresh(); });

  return {
    stop: () => {
      if (!alive) return;
      alive = false;
      unwatch?.();
      unlisten();
      document.removeEventListener('visibilitychange', onHide);
      timers.forEach((q) => clearTimeout(q.timer));
      pending -= timers.size;
    },
    flush,
    unsynced: async () => (await a.list()).filter((it) => !synced.has(it.id) || dirty.has(it.id)).length,
  };
}

type PackageItem = Stamped & { files: Files };

let current: { uid: string; handles: Handle[]; stop: () => void } | null = null;

/** Start syncing for this user; the returned function stops it (local data stays). */
export function startSync(uid: string): () => void {
  pending = 0;
  failed = false;
  setState('syncing');
  const systems = syncCollection<PackageItem>(uid, {
    col: 'systems',
    list: listCustomPackages,
    fromRemote: (d) => (d.data && typeof d.data === 'object' ? { id: d.id, updatedAt: d.updatedAt, files: d.data as Files } : null),
    payload: (p) => p.files,
    apply: async (p) => { await addPackage(p.files, 'remote', p.updatedAt).catch(() => {}); },
    remove: (id) => removePackage(id, 'remote'),
    onLocalChange: (cb) => onPackageChange((id, files, updatedAt, origin) => cb(id, files ? { id, updatedAt, files } : null, origin)),
  });
  const sheets = syncCollection<Character>(uid, {
    col: 'sheets',
    list: allCharacters,
    fromRemote: (d) => (d.data && typeof d.data === 'object' ? (d.data as Character) : null),
    payload: (c) => c,
    apply: (c) => putCharacter(c, 'remote'),
    remove: (id) => deleteCharacter(id, 'remote'),
    onLocalChange: onCharacterChange,
  });
  const stopShares = startShares(uid);
  const stop = () => {
    systems.stop();
    sheets.stop();
    stopShares();
    if (current?.stop === stop) current = null;
    setState('off');
  };
  current = { uid, handles: [systems, sheets], stop };
  return stop;
}

/**
 * Sign out of the account and clear this device: everything lives in the cloud, so the next person
 * (or account) on this browser starts empty. Pending edits are sent first; if some cannot be sent
 * (offline) `confirmLoss` decides. Returns false when the user backed out.
 */
export async function signOutAndClear(signOut: () => Promise<void>, confirmLoss: (n: number) => boolean): Promise<boolean> {
  const cur = current;
  if (cur) {
    await Promise.all(cur.handles.map((h) => h.flush()));
    const n = (await Promise.all(cur.handles.map((h) => h.unsynced()))).reduce((x, y) => x + y, 0);
    if (n > 0 && !confirmLoss(n)) return false;
    cur.stop();
  }
  await signOut();
  allCharacters().forEach((c) => deleteCharacter(c.id, 'remote'));
  for (const p of await listCustomPackages()) await removePackage(p.id, 'remote');
  if (cur) for (const col of ['sheets', 'systems'] as const) try { localStorage.removeItem(syncedKey(cur.uid, col)); } catch { /* ignore */ }
  return true;
}
