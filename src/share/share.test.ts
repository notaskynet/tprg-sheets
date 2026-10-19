import { describe, expect, it } from 'vitest';
import { BUILTIN_PACKAGES } from '@/systems/builtin';
import { newCharacter, setValue, type Character } from '@/engine/character';
import { formatCode, newRoomCode, normalizeCode, isMsg } from './protocol';
import { memoryHub } from './transport';
import { Session } from './session';
import { roomId } from './transport';

const pkg = BUILTIN_PACKAGES[0];
const mk = (id: string, name: string, at = 1): Character =>
  ({ ...setValue(newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, id), 'profile.name', name), updatedAt: at });
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('room codes', () => {
  it('generates readable codes and normalizes input', () => {
    const c = newRoomCode();
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(normalizeCode(formatCode(c).toLowerCase())).toBe(c);
    expect(normalizeCode('abc-12')).toBeNull(); // too short
    expect(normalizeCode('ABCD-OIOO')).toBeNull(); // ambiguous letters are not in the alphabet
    expect(formatCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });
  it('validates messages', () => {
    expect(isMsg({ t: 'roll', who: 'a', label: '', summary: '+2', ts: 1 })).toBe(true);
    expect(isMsg({ t: 'nope' })).toBe(false);
    expect(isMsg(null)).toBe(false);
  });
});

describe('room id', () => {
  it('is derived from the code without revealing it, and differs per code', async () => {
    const a = await roomId('ABCD2345', 's');
    expect(a).toBe(await roomId('ABCD2345', 's'));
    expect(a).not.toContain('ABCD2345');
    expect(a).not.toBe(await roomId('ABCD2346', 's'));
  });
  it('codes do not repeat in practice', () => {
    const seen = new Set(Array.from({ length: 50_000 }, () => newRoomCode()));
    expect(seen.size).toBe(50_000);
  });
});

describe('session', () => {
  it('detects two GMs in one room', async () => {
    const hub = memoryHub();
    const a = new Session(hub.join('g1'), 'gm', 'A', 'ABCD2345');
    const b = new Session(hub.join('g2'), 'gm', 'B', 'ABCD2345');
    await tick();
    expect(a.getState().conflict).toBe(true);
    expect(b.getState().conflict).toBe(true);
  });

  it('GM sees players, their characters, live updates, and the roll feed', async () => {
    const hub = memoryHub();
    const gm = new Session(hub.join('g'), 'gm', 'Мастер', 'ABCD2345');
    const hero = mk('c1', 'Нокс');
    const p1 = new Session(hub.join('p1'), 'player', 'Даня', 'ABCD2345', () => [hero]);
    const p2 = new Session(hub.join('p2'), 'player', 'Лена', 'ABCD2345', () => []);
    await tick();

    let s = gm.getState();
    expect(s.players.map((p) => p.name).sort()).toEqual(['Даня', 'Лена']);
    expect(s.players.find((p) => p.name === 'Даня')!.chars.map((c) => c.values.profile)).toMatchObject([{ name: 'Нокс' }]);
    expect(p1.getState().gmPresent).toBe(true);

    p1.pushCharacter(setValue(hero, 'profile.name', 'Нокс II'));
    p2.roll({ label: 'Сила + Драка', summary: '+3' });
    await tick();
    s = gm.getState();
    expect((s.players.find((p) => p.name === 'Даня')!.chars[0].values.profile as { name: string }).name).toBe('Нокс II');
    expect(s.feed[0]).toMatchObject({ who: 'Лена', summary: '+3' });
    expect(p1.getState().feed[0].who).toBe('Лена'); // players see the feed too
  });

  it('keeps a disconnected player cached and re-attaches on reconnect', async () => {
    const hub = memoryHub();
    const gm = new Session(hub.join('g'), 'gm', 'Мастер', 'ABCD2345');
    const hero = mk('c1', 'Нокс');
    const first = new Session(hub.join('p1'), 'player', 'Даня', 'ABCD2345', () => [hero]);
    await tick();
    await first.leave();
    await tick();
    expect(gm.getState().players[0]).toMatchObject({ name: 'Даня', online: false });
    expect(gm.getState().players[0].chars).toHaveLength(1); // cached

    new Session(hub.join('p1b'), 'player', 'Даня', 'ABCD2345', () => [hero]);
    await tick();
    const players = gm.getState().players;
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ online: true, peerId: 'p1b' });
  });

  it('a late-joining GM receives characters from players already in the room', async () => {
    const hub = memoryHub();
    new Session(hub.join('p1'), 'player', 'Даня', 'ABCD2345', () => [mk('c1', 'Нокс')]);
    await tick();
    const gm = new Session(hub.join('g'), 'gm', 'Мастер', 'ABCD2345');
    await tick();
    expect(gm.getState().players[0].chars).toHaveLength(1);
  });
});

import { codeFromInput } from './protocol';
describe('codeFromInput', () => {
  it('accepts a typed code or a pasted invite link', () => {
    expect(codeFromInput('abcd-2345')).toBe('ABCD2345');
    expect(codeFromInput('https://x.github.io/tprg-sheets/?join=ABCD2345')).toBe('ABCD2345');
    expect(codeFromInput('https://x.dev/?join=abcd-2345')).toBe('ABCD2345');
    expect(codeFromInput('https://x.dev/?c=1')).toBeNull();
    expect(codeFromInput('')).toBeNull();
  });
});

describe('session lifecycle', () => {
  it('players learn that the GM closed the game', async () => {
    const hub = memoryHub();
    const gm = new Session(hub.join('g'), 'gm', 'GM', 'ABCD2345');
    const pl = new Session(hub.join('p'), 'player', 'P', 'ABCD2345', () => []);
    await tick();
    expect(pl.getState().ended).toBe(false);
    await gm.leave();
    await tick();
    expect(pl.getState().ended).toBe(true);
  });

  it('a GM leaving because of a code collision does not end the other room', async () => {
    const hub = memoryHub();
    const a = new Session(hub.join('g1'), 'gm', 'A', 'ABCD2345');
    const b = new Session(hub.join('g2'), 'gm', 'B', 'ABCD2345');
    const pl = new Session(hub.join('p'), 'player', 'P', 'ABCD2345', () => []);
    await tick();
    await b.leave(false);
    await tick();
    expect(pl.getState().ended).toBe(false);
    expect(a.getState().ended).toBe(false);
  });

  it('a new list of shared characters replaces the old one', async () => {
    const hub = memoryHub();
    const gm = new Session(hub.join('g'), 'gm', 'GM', 'ABCD2345');
    let list = [mk('c1', 'A'), mk('c2', 'B')];
    const pl = new Session(hub.join('p'), 'player', 'P', 'ABCD2345', () => list);
    await tick();
    expect(gm.getState().players[0].chars).toHaveLength(2);
    list = [list[1]];
    pl.pushShared();
    await tick();
    expect(gm.getState().players[0].chars.map((c) => c.id)).toEqual(['c2']);
  });
});

describe('session: who is the GM', () => {
  it('a player learns the GM name', async () => {
    const hub = memoryHub();
    new Session(hub.join('g'), 'gm', 'Даня', 'ABCD2345');
    const pl = new Session(hub.join('p'), 'player', 'P', 'ABCD2345', () => []);
    await tick();
    expect(pl.getState()).toMatchObject({ gmPresent: true, gmName: 'Даня' });
  });
});
