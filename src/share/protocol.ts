// Wire protocol shared by device transfer and live sessions. One JSON message type.
import type { Character } from '@/engine/character';
import type { Files } from '@/engine/loader';

export type Role = 'gm' | 'player' | 'sender' | 'receiver';

export type Msg =
  | { t: 'hello'; role: Role; name: string }
  | { t: 'chars'; chars: Character[]; pkgs?: Record<string, Files> } // transfer payload / full player sync
  | { t: 'char'; char: Character } // live update of one character
  | { t: 'roll'; who: string; label: string; summary: string; ts: number };

export interface RollEntry { who: string; label: string; summary: string; ts: number }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const CODE_LENGTH = 8; // 32^8 ≈ 1.1e12 codes

export function newRoomCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(rand(CODE_LENGTH), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Accepts "abc-def", "ABC DEF", etc. Returns the canonical code or null. */
export function normalizeCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === CODE_LENGTH && [...c].every((ch) => ALPHABET.includes(ch)) ? c : null;
}

export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

export function isMsg(x: unknown): x is Msg {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  switch (m.t) {
    case 'hello': return typeof m.role === 'string' && typeof m.name === 'string';
    case 'chars': return Array.isArray(m.chars);
    case 'char': return !!m.char && typeof m.char === 'object';
    case 'roll': return typeof m.who === 'string' && typeof m.summary === 'string';
    default: return false;
  }
}
