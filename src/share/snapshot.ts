// Offline sharing: a character snapshot packed into a URL fragment.
// JSON → deflate-raw → base64url, carried in `#s=…` (the fragment never reaches a server).
import type { Character } from '@/engine/character';

const VERSION = 1;

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export async function encodeSnapshot(ch: Character): Promise<string> {
  const { creation: _creation, ...rest } = ch;
  const json = new TextEncoder().encode(JSON.stringify({ v: VERSION, c: rest }));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeSnapshot(data: string): Promise<Character> {
  const json = new TextDecoder().decode(await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw')));
  const parsed = JSON.parse(json);
  if (parsed?.v !== VERSION || !parsed.c?.system?.id || typeof parsed.c.values !== 'object') throw new Error('Not a trpg-sheets snapshot');
  return { ...parsed.c, creation: { step: 0, done: true } } as Character;
}

export async function snapshotLink(ch: Character, base = `${location.origin}${location.pathname}`): Promise<string> {
  return `${base}#s=${await encodeSnapshot(ch)}`;
}

/** Extracts the snapshot payload from a location hash, or null. */
export const snapshotFromHash = (hash: string): string | null => (hash.startsWith('#s=') ? hash.slice(3) : null);
