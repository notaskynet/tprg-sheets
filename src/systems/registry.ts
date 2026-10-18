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

export async function removePackage(id: string): Promise<void> {
  if (isBuiltin(id)) return;
  packages.delete(id);
  await deletePackageFiles(id);
  emit();
}
export const usePackages = () => useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), () => list);

/** Validates and registers an imported package (throws PackageError). Persists it. */
export async function addPackage(files: Files): Promise<SystemPackage> {
  const pkg = loadPackage(files);
  if (isBuiltin(pkg.manifest.id)) throw new Error(`"${pkg.manifest.id}" is a built-in system id; change \`id\` in system.toml`);
  packages.set(pkg.manifest.id, pkg);
  await savePackageFiles(pkg.manifest.id, files);
  emit();
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
