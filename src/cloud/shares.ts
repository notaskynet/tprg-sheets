// Live read-only links to a sheet. The owner switches a link on per sheet; while it is on, every
// local edit refreshes the shared copy. Switching it off deletes the copy, so the link stops working.
import { useSyncExternalStore } from 'react';
import type { Character } from '@/engine/character';
import { onCharacterChange } from '@/storage/db';
import { deleteShare, putShare, watchOwnShares } from './firebase';

const PUSH_DELAY = 2000;

let shares = new Map<string, string>(); // sheetId -> shareId
let uidNow: string | null = null;
const listeners = new Set<() => void>();
const set = (next: Map<string, string>) => { shares = next; listeners.forEach((l) => l()); };

export const useShares = (): Map<string, string> => useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), () => shares);

/** What viewers get: the sheet without creation bookkeeping. */
const publicCopy = (ch: Character): Character => ({ ...ch, creation: { step: 0, done: true } });

export const shareLink = (shareId: string) => `${location.origin}${location.pathname}?view=${shareId}`;

export async function createShare(ch: Character): Promise<void> {
  if (!uidNow) throw new Error('Not signed in');
  const shareId = crypto.randomUUID();
  await putShare(uidNow, shareId, ch.id, ch.updatedAt, publicCopy(ch));
  set(new Map(shares).set(ch.id, shareId));
}

export async function stopShare(sheetId: string): Promise<void> {
  const shareId = shares.get(sheetId);
  if (!shareId) return;
  await deleteShare(shareId);
  const next = new Map(shares);
  next.delete(sheetId);
  set(next);
}

export function startShares(uid: string): () => void {
  uidNow = uid;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let alive = true;
  let unwatch: (() => void) | undefined;

  void watchOwnShares(uid, (m) => { if (alive) set(m); }, () => {})
    .then((fn) => { if (alive) unwatch = fn; else fn(); })
    .catch(() => {});

  const unlisten = onCharacterChange((id, ch, origin) => {
    const shareId = shares.get(id);
    if (!shareId) return;
    clearTimeout(timers.get(id));
    if (!ch) {
      if (origin === 'local') void stopShare(id).catch(() => {}); // deleting a sheet ends its link
      return;
    }
    if (origin !== 'local') return;
    timers.set(id, setTimeout(() => {
      timers.delete(id);
      void putShare(uid, shareId, id, ch.updatedAt, publicCopy(ch)).catch(() => {});
    }, PUSH_DELAY));
  });

  return () => {
    alive = false;
    uidNow = null;
    unwatch?.();
    unlisten();
    timers.forEach((t) => clearTimeout(t));
    set(new Map());
  };
}
