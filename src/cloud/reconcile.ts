// Pure merge rule for syncing a local collection with its cloud copy.
export interface Stamped { id: string; updatedAt: number }

export interface Plan<T> {
  toLocal: T[]; // remote is newer or missing locally
  toRemote: T[]; // local is newer or was never uploaded
  deleteLocal: string[]; // removed in the cloud (from another device) after we had synced it
}

/**
 * Newest `updatedAt` wins. A local record missing from the cloud is uploaded, unless we have
 * synced it before: then it was deleted elsewhere. `canDelete` is false while the remote view is
 * only a stale cache, so a half-loaded snapshot never wipes local data.
 */
export function reconcile<T extends Stamped>(local: T[], remote: T[], synced: ReadonlySet<string>, canDelete = true): Plan<T> {
  const plan: Plan<T> = { toLocal: [], toRemote: [], deleteLocal: [] };
  const localById = new Map(local.map((l) => [l.id, l]));
  const remoteIds = new Set(remote.map((r) => r.id));
  for (const r of remote) {
    const l = localById.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) plan.toLocal.push(r);
    else if (l.updatedAt > r.updatedAt) plan.toRemote.push(l);
  }
  for (const l of local) {
    if (remoteIds.has(l.id)) continue;
    if (!synced.has(l.id)) plan.toRemote.push(l);
    else if (canDelete) plan.deleteLocal.push(l.id);
  }
  return plan;
}
