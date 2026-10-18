import { describe, expect, it } from 'vitest';
import { reconcile } from './reconcile';

const it_ = (id: string, updatedAt: number) => ({ id, updatedAt });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('reconcile', () => {
  it('takes the newer side and fills gaps both ways', () => {
    const plan = reconcile(
      [it_('same', 5), it_('localNewer', 9), it_('remoteNewer', 1), it_('onlyLocal', 3)],
      [it_('same', 5), it_('localNewer', 4), it_('remoteNewer', 7), it_('onlyRemote', 2)],
      new Set(),
    );
    expect(ids(plan.toLocal).sort()).toEqual(['onlyRemote', 'remoteNewer']);
    expect(ids(plan.toRemote).sort()).toEqual(['localNewer', 'onlyLocal']);
    expect(plan.deleteLocal).toEqual([]);
  });
  it('deletes locally what another device deleted, but only if it had been synced', () => {
    const local = [it_('gone', 1), it_('fresh', 1)];
    const plan = reconcile(local, [], new Set(['gone']));
    expect(plan.deleteLocal).toEqual(['gone']);
    expect(ids(plan.toRemote)).toEqual(['fresh']);
  });
  it('never deletes from a cache-only view', () => {
    const plan = reconcile([it_('a', 1)], [], new Set(['a']), false);
    expect(plan.deleteLocal).toEqual([]);
    expect(plan.toRemote).toEqual([]);
  });
});
