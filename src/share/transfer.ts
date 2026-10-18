// Device-to-device transfer: the sender waits in a one-off room, the receiver joins
// with the code and gets the chosen characters plus any custom systems they need.
import type { Character } from '@/engine/character';
import type { Files } from '@/engine/loader';
import type { Transport } from './transport';

export interface TransferPayload { chars: Character[]; pkgs?: Record<string, Files> }

/** Sender: answers every receiver that says hello with the payload. Returns a stop function. */
export function runSender(t: Transport, payload: TransferPayload, on: { sent?: (peer: string) => void } = {}): () => void {
  let stopped = false;
  t.onMessage((m, from) => {
    if (stopped || m.t !== 'hello' || m.role !== 'receiver') return;
    t.send({ t: 'chars', chars: payload.chars, pkgs: payload.pkgs }, from);
    on.sent?.(from);
  });
  return () => { stopped = true; };
}

/** Receiver: announces itself to every peer and reports the first payload received. */
export function runReceiver(t: Transport, on: { received: (p: TransferPayload) => void }): () => void {
  let stopped = false;
  const seen = new Set<string>();
  const hello = (peers: string[]) => {
    for (const p of peers) if (!seen.has(p)) { seen.add(p); t.send({ t: 'hello', role: 'receiver', name: '' }, p); }
  };
  t.onPeers(hello);
  t.onMessage((m) => { if (!stopped && m.t === 'chars') on.received({ chars: m.chars, pkgs: m.pkgs }); });
  hello(t.peers());
  return () => { stopped = true; };
}

export type ImportStatus = 'new' | 'newer' | 'older' | 'same';
export interface ImportItem { char: Character; status: ImportStatus }

/** Compares incoming characters with local ones (by id and updatedAt). */
export function planImport(local: (id: string) => Character | undefined, incoming: Character[]): ImportItem[] {
  return incoming.map((char) => {
    const mine = local(char.id);
    const status: ImportStatus = !mine ? 'new' : char.updatedAt > mine.updatedAt ? 'newer' : char.updatedAt < mine.updatedAt ? 'older' : 'same';
    return { char, status };
  });
}
