// The one live session this tab is part of. It outlives screen changes (a player
// opens a sheet while connected) and is resumed after a reload from sessionStorage.
import { useSyncExternalStore } from 'react';
import { getCharacter, subscribe as subscribeStorage } from '@/storage/db';
import { newRoomCode } from './protocol';
import { Session, type SessionState } from './session';
import { openRoom } from './transport';

export interface ActiveInfo { status: 'idle' | 'connecting' | 'active' | 'error'; error?: string; session?: Session; sharedIds?: string[]; ended?: boolean }

interface Saved { role: 'gm' | 'player'; code: string; name: string; sharedIds: string[] }
const KEY = 'trpg.session';
const SHARED_KEY = 'trpg.sharedIds';

let info: ActiveInfo = { status: 'idle' };
const subs = new Set<() => void>();
const set = (next: ActiveInfo) => { info = next; subs.forEach((cb) => cb()); };
let unsubStorage: (() => void) | null = null;

const getActive = () => info;
export const getActiveSession = () => info.session;
export const useActive = (): ActiveInfo => useSyncExternalStore((cb) => (subs.add(cb), () => void subs.delete(cb)), getActive);

/** Live state of the active session (null when none). */
export function useSessionState(): SessionState | null {
  const { session } = useActive();
  return useSyncExternalStore(
    (cb) => (session ? session.subscribe(cb) : () => {}),
    () => session?.getState() ?? null,
  );
}

export async function startSession(opts: { role: 'gm' | 'player'; name: string; code?: string; sharedIds?: string[] }, bye = true): Promise<void> {
  await leaveSession(bye);
  const code = opts.code ?? newRoomCode();
  let sharedIds = opts.sharedIds ?? [];
  set({ status: 'connecting', sharedIds });
  try {
    const transport = await openRoom({ code, kind: 's' });
    const shared = () => sharedIds.map(getCharacter).filter((c): c is NonNullable<typeof c> => !!c);
    const session = new Session(transport, opts.role, opts.name, code, shared);
    // Two GMs in one room means the code collided: the host moves to a fresh code.
    if (opts.role === 'gm') {
      const off = session.subscribe(() => {
        if (session.getState().conflict && info.session === session) { off(); void startSession({ role: 'gm', name: opts.name }, false); }
      });
    }
    const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ role: opts.role, code, name: opts.name, sharedIds } satisfies Saved)); } catch { /* ignore */ } };
    save();
    changeShared = (ids) => {
      sharedIds = ids;
      save();
      try { localStorage.setItem(SHARED_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
      set({ ...info, sharedIds: ids });
      session.pushShared();
    };

    // Players: push edits of shared characters (debounced) so the GM sees them live.
    if (opts.role === 'player') {
      const last = new Map(shared().map((c) => [c.id, c.updatedAt]));
      let timer: ReturnType<typeof setTimeout> | undefined;
      unsubStorage = subscribeStorage(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          for (const c of shared()) if (c.updatedAt !== last.get(c.id)) { last.set(c.id, c.updatedAt); session.pushCharacter(c); }
        }, 300);
      });
    }
    // The GM closed the game: a player leaves too instead of waiting for a GM who is gone.
    if (opts.role === 'player') {
      const off = session.subscribe(() => {
        if (session.getState().ended && info.session === session) { off(); void leaveSession(false).then(() => set({ status: 'idle', ended: true })); }
      });
    }
    set({ status: 'active', session, sharedIds });
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
  }
}

/** Player: change which sheets the GM sees, live. */
export function setSharedIds(ids: string[]) { changeShared?.(ids); }
let changeShared: ((ids: string[]) => void) | null = null;

export async function leaveSession(bye?: boolean): Promise<void> {
  unsubStorage?.();
  unsubStorage = null;
  changeShared = null;
  const s = info.session;
  set({ status: 'idle' });
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  await s?.leave(bye).catch(() => {});
}

/** After a page reload: rejoin the same room with the same identity. */
export function resumeSession(): void {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as Saved;
    void startSession({ role: s.role, name: s.name, code: s.code, sharedIds: s.sharedIds });
  } catch { /* ignore */ }
}
