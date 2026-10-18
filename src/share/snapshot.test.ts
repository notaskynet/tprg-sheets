import { describe, expect, it } from 'vitest';
import { BUILTIN_PACKAGES } from '@/systems/builtin';
import { newCharacter, setValue } from '@/engine/character';
import { decodeSnapshot, encodeSnapshot, snapshotFromHash } from './snapshot';

const pkg = BUILTIN_PACKAGES[0];

describe('snapshot codec', () => {
  it('round-trips a character through a url-safe string', async () => {
    let ch = newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, 'abc');
    ch = setValue(ch, 'profile.name', 'Нокс «Тень»');
    ch = setValue(ch, 'attributes.strength', 4);
    const enc = await encodeSnapshot(ch);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = await decodeSnapshot(enc);
    expect(back.id).toBe('abc');
    expect(back.values).toEqual(ch.values);
    expect(back.creation).toEqual({ step: 0, done: true });
  });
  it('stays compact enough for a link / QR code', async () => {
    const ch = newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, crypto.randomUUID());
    expect((await encodeSnapshot(ch)).length).toBeLessThan(1500);
  });
  it('rejects garbage', async () => {
    await expect(decodeSnapshot('not-a-snapshot')).rejects.toThrow();
  });
  it('reads the fragment', () => {
    expect(snapshotFromHash('#s=abc')).toBe('abc');
    expect(snapshotFromHash('#x')).toBeNull();
  });
});
