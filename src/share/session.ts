// Live game session over a Transport. Every participant keeps its own data; the GM
// caches the last snapshot of each player's shared characters and sees everyone's rolls.
import type { Character } from '@/engine/character';
import type { Role, RollEntry } from './protocol';
import type { Transport } from './transport';

export interface PlayerView {
  name: string;
  online: boolean;
  peerId: string;
  chars: Character[];
}

export interface SessionState {
  role: Role;
  code: string;
  gmPresent: boolean;
  peerCount: number;
  players: PlayerView[]; // GM only
  feed: RollEntry[]; // newest first
  conflict: boolean; // another GM is in this room (the code collided)
  ended: boolean; // player: the GM closed the game
}

const FEED_MAX = 100;

interface PlayerRec { name: string; online: boolean; peerId: string; chars: Map<string, Character> }

export class Session {
  private players = new Map<string, PlayerRec>();
  private feed: RollEntry[] = [];
  private gmPeers = new Set<string>();
  private conflict = false;
  private ended = false;
  private known = new Set<string>();
  private subs = new Set<() => void>();
  private snapshot: SessionState;

  constructor(
    private t: Transport,
    readonly role: 'gm' | 'player',
    readonly name: string,
    readonly code: string,
    private shared: () => Character[] = () => [],
  ) {
    this.snapshot = this.build();
    t.onMessage((m, from) => this.handle(m, from));
    t.onPeers((peers) => this.peersChanged(peers));
    this.peersChanged(t.peers());
  }

  subscribe = (cb: () => void) => (this.subs.add(cb), () => void this.subs.delete(cb));
  getState = () => this.snapshot;

  /** Player: publish (the current version of) one character. */
  pushCharacter(char: Character) {
    if (this.role === 'player') this.t.send({ t: 'char', char });
  }

  /** Everyone: broadcast a roll and show it in the local feed. */
  roll(entry: Omit<RollEntry, 'who' | 'ts'>) {
    const full: RollEntry = { ...entry, who: this.name, ts: Date.now() };
    this.t.send({ t: 'roll', ...full });
    this.addRoll(full);
  }

  /** Player: the set of shared characters changed; the GM replaces what it holds. */
  pushShared() {
    if (this.role === 'player') this.t.send({ t: 'chars', chars: this.shared() });
  }

  /** `bye`: tell the players the game is over (not when leaving because the code collided). */
  async leave(bye = this.role === 'gm') {
    if (bye) {
      this.t.send({ t: 'bye' });
      await new Promise((r) => setTimeout(r, 80)); // let the message out before the room closes
    }
    return this.t.leave();
  }

  private announce(to: string) {
    this.t.send({ t: 'hello', role: this.role, name: this.name }, to);
    if (this.role === 'player') this.t.send({ t: 'chars', chars: this.shared() }, to);
  }

  private peersChanged(peers: string[]) {
    for (const p of peers) if (!this.known.has(p)) { this.known.add(p); this.announce(p); }
    for (const p of [...this.known]) if (!peers.includes(p)) {
      this.known.delete(p);
      this.gmPeers.delete(p);
      for (const pl of this.players.values()) if (pl.peerId === p) pl.online = false;
    }
    this.changed(peers.length);
  }

  private handle(m: import('./protocol').Msg, from: string) {
    switch (m.t) {
      case 'hello':
        if (m.role === 'gm') this.gmPeers.add(from);
        if (m.role === 'gm' && this.role === 'gm') this.conflict = true;
        if (this.role === 'gm' && m.role === 'player') this.player(from, m.name);
        break;
      case 'chars':
      case 'char': {
        if (this.role !== 'gm') return;
        const pl = [...this.players.values()].find((p) => p.peerId === from);
        if (!pl) return; // chars before hello: ignored; the player re-announces on peer join
        if (m.t === 'chars') pl.chars = new Map(m.chars.map((c) => [c.id, c])); // a full list replaces the old one
        else pl.chars.set(m.char.id, m.char);
        break;
      }
      case 'bye':
        if (this.role === 'player' && this.gmPeers.has(from)) this.ended = true;
        break;
      case 'roll':
        this.addRoll({ who: m.who, label: m.label, summary: m.summary, ts: m.ts });
        return;
    }
    this.changed();
  }

  /** One entry per player name: a reconnect (new peer id) takes over the old entry. */
  private player(peerId: string, name: string) {
    const existing = this.players.get(name);
    if (existing && existing.online && existing.peerId !== peerId) name = this.uniqueName(name);
    const pl: PlayerRec = this.players.get(name) ?? { name, online: true, peerId, chars: new Map() };
    pl.peerId = peerId;
    pl.online = true;
    this.players.set(name, pl);
  }

  private uniqueName(base: string) {
    for (let i = 2; ; i++) if (!this.players.get(`${base} #${i}`)?.online) return `${base} #${i}`;
  }

  private addRoll(e: RollEntry) {
    this.feed = [e, ...this.feed].slice(0, FEED_MAX);
    this.changed();
  }

  private peerCount = 0;
  private changed(count = this.peerCount) {
    this.peerCount = count;
    this.snapshot = this.build();
    this.subs.forEach((cb) => cb());
  }

  private build(): SessionState {
    return {
      role: this.role,
      code: this.code,
      gmPresent: this.gmPeers.size > 0,
      peerCount: this.peerCount,
      players: [...this.players.values()].map((p) => ({ name: p.name, online: p.online, peerId: p.peerId, chars: [...p.chars.values()] })),
      feed: this.feed,
      conflict: this.conflict,
      ended: this.ended,
    };
  }
}
