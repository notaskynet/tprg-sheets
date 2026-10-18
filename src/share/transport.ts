// Transport abstraction. The real one is WebRTC via Trystero (signalling over public
// Nostr relays, no server of ours); tests use the in-memory hub.
import { isMsg, type Msg } from './protocol';

export interface Transport {
  readonly selfId: string;
  send(msg: Msg, to?: string): void; // broadcast when `to` is omitted
  onMessage(cb: (msg: Msg, from: string) => void): void;
  onPeers(cb: (peers: string[]) => void): void;
  peers(): string[];
  leave(): Promise<void>;
}

export interface RoomOptions {
  code: string;
  kind: 's'; // s = game session; reserved so other room types get distinct ids
  turn?: { urls: string; username?: string; credential?: string }; // optional own TURN server
}

/**
 * The relays see the room id, so it must not reveal the code (which is the encryption
 * password): the id is a hash of the code. Only people who know the code can derive
 * the id, find the room and decrypt its traffic.
 */
export async function roomId(code: string, kind: RoomOptions['kind']): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`trpg-sheets/${kind}/${code}`));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${kind}-${hex.slice(0, 24)}`;
}

/** WebRTC room, end-to-end encrypted with the room code as password. */
export async function openRoom({ code, kind, turn }: RoomOptions): Promise<Transport> {
  const { joinRoom, selfId } = await import('trystero');
  const room = joinRoom(
    { appId: 'trpg-sheets', password: code, ...(turn ? { turnConfig: [turn] } : {}) },
    await roomId(code, kind),
  );
  const action = room.makeAction<never>('m');
  const peers = new Set<string>();
  const peerCbs: ((p: string[]) => void)[] = [];
  const msgCbs: ((m: Msg, from: string) => void)[] = [];
  const emit = () => peerCbs.forEach((cb) => cb([...peers]));

  room.onPeerJoin = (id) => { peers.add(id); emit(); };
  room.onPeerLeave = (id) => { peers.delete(id); emit(); };
  action.onMessage = (data, ctx) => { if (isMsg(data)) msgCbs.forEach((cb) => cb(data, ctx.peerId)); };

  return {
    selfId,
    send: (msg, to) => { void action.send(msg as never, to ? { target: to } : undefined).catch(() => {}); },
    onMessage: (cb) => void msgCbs.push(cb),
    onPeers: (cb) => void peerCbs.push(cb),
    peers: () => [...peers],
    leave: () => room.leave(),
  };
}

/** In-memory hub for tests: every joined node is connected to every other. */
export function memoryHub() {
  type Node = { t: Transport; msg: ((m: Msg, f: string) => void)[]; peers: ((p: string[]) => void)[] };
  const nodes = new Map<string, Node>();
  const notify = () => nodes.forEach((n, id) => { const others = [...nodes.keys()].filter((k) => k !== id); n.peers.forEach((cb) => cb(others)); });
  return {
    join(id: string): Transport {
      const node: Node = {
        msg: [], peers: [],
        t: {
          selfId: id,
          send: (msg, to) => {
            const copy = JSON.parse(JSON.stringify(msg)) as Msg; // behave like the wire
            for (const [k, n] of nodes) if (k !== id && (!to || to === k)) queueMicrotask(() => n.msg.forEach((cb) => cb(copy, id)));
          },
          onMessage: (cb) => void node.msg.push(cb),
          onPeers: (cb) => void node.peers.push(cb),
          peers: () => [...nodes.keys()].filter((k) => k !== id),
          leave: async () => { nodes.delete(id); notify(); },
        },
      };
      nodes.set(id, node);
      queueMicrotask(notify);
      return node.t;
    },
  };
}
