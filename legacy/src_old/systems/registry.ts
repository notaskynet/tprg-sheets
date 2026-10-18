// System registry. Adding a new VtM system is: implement GameSystem, then
// `register(mySystem)` in systems/index.ts. Nothing else in the app changes.

import type { GameSystem } from './types';

const systems = new Map<string, GameSystem>();

export function register(system: GameSystem): void {
  if (systems.has(system.id)) {
    throw new Error(`System "${system.id}" is already registered`);
  }
  systems.set(system.id, system);
}

export function getSystem(id: string): GameSystem {
  const sys = systems.get(id);
  if (!sys) throw new Error(`Unknown system "${id}"`);
  return sys;
}

export function hasSystem(id: string): boolean {
  return systems.has(id);
}

export function listSystems(): GameSystem[] {
  return [...systems.values()];
}

/** The system new characters default to when none is specified. */
export const DEFAULT_SYSTEM_ID = 'vtm-v20';
