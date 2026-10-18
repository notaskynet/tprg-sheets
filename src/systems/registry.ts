// Runtime registry of system packages: bundled ones plus user-imported (IndexedDB).
import { useSyncExternalStore } from 'react';
import { loadPackage, type Files } from '@/engine/loader';
import type { SystemPackage } from '@/engine/schema';
import { BUILTIN_FILES, BUILTIN_PACKAGES } from './builtin';
import { deletePackageFiles, getPackageFiles, loadPackageFiles, savePackageFiles } from '@/storage/db';

let packages = new Map<string, SystemPackage>(BUILTIN_PACKAGES.map((p) => [p.manifest.id, p]));
let list = [...packages.values()];
const listeners = new Set<() => void>();
const emit = () => { list = [...packages.values()]; listeners.forEach((l) => l()); };

export const getPackage = (id: string) => packages.get(id);
export const isBuiltin = (id: string) => BUILTIN_PACKAGES.some((b) => b.manifest.id === id);

/** Source files of an installed system (bundled or imported). */
export async function getSourceFiles(id: string): Promise<Files | undefined> {
  return BUILTIN_FILES[id] ?? (await getPackageFiles(id));
}

// Imported systems carry a last-modified stamp (for cloud sync); bundled ones never sync.
const STAMPS_KEY = 'trpg.pkgStamps';
function readStamps(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STAMPS_KEY) ?? '{}'); } catch { return {}; }
}
function writeStamp(id: string, at: number | null) {
  const s = readStamps();
  if (at === null) delete s[id]; else s[id] = at;
  try { localStorage.setItem(STAMPS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export type Origin = 'local' | 'remote';
type PackageChange = (id: string, files: Files | null, updatedAt: number, origin: Origin) => void;
const changeListeners = new Set<PackageChange>();
export const onPackageChange = (cb: PackageChange) => (changeListeners.add(cb), () => void changeListeners.delete(cb));

/** Imported (non-bundled) systems with their source files, for syncing. */
export async function listCustomPackages(): Promise<{ id: string; updatedAt: number; files: Files }[]> {
  const stamps = readStamps();
  const out: { id: string; updatedAt: number; files: Files }[] = [];
  for (const id of packages.keys()) {
    if (isBuiltin(id)) continue;
    const files = await getPackageFiles(id);
    if (files) out.push({ id, updatedAt: stamps[id] ?? 0, files });
  }
  return out;
}

export async function removePackage(id: string, origin: Origin = 'local'): Promise<void> {
  if (isBuiltin(id)) return;
  packages.delete(id);
  await deletePackageFiles(id);
  writeStamp(id, null);
  emit();
  changeListeners.forEach((l) => l(id, null, Date.now(), origin));
}
export const usePackages = () => useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), () => list);

/** Validates and registers an imported package (throws PackageError). Persists it. */
export async function addPackage(files: Files, origin: Origin = 'local', updatedAt = Date.now()): Promise<SystemPackage> {
  const pkg = loadPackage(files);
  if (isBuiltin(pkg.manifest.id)) throw new Error(`"${pkg.manifest.id}" is a built-in system id; change \`id\` in system.toml`);
  packages.set(pkg.manifest.id, pkg);
  await savePackageFiles(pkg.manifest.id, files);
  writeStamp(pkg.manifest.id, updatedAt);
  emit();
  changeListeners.forEach((l) => l(pkg.manifest.id, files, updatedAt, origin));
  return pkg;
}

export async function initPackages(): Promise<void> {
  for (const files of await loadPackageFiles()) {
    try {
      const pkg = loadPackage(files);
      if (!BUILTIN_PACKAGES.some((b) => b.manifest.id === pkg.manifest.id)) packages.set(pkg.manifest.id, pkg);
    } catch { /* broken stored package: ignore */ }
  }
  emit();
}
