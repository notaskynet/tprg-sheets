// Built-in system packages, bundled from /systems/<id>/**/*.toml at build time.
import { loadPackage, type Files } from '@/engine/loader';
import type { SystemPackage } from '@/engine/schema';

const raw = import.meta.glob('/systems/**/*.toml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function byPackage(): Record<string, Files> {
  const out: Record<string, Files> = {};
  for (const [path, src] of Object.entries(raw)) {
    const m = /^\/systems\/([^/]+)\/(.+)$/.exec(path);
    if (m) (out[m[1]] ??= {})[m[2]] = src;
  }
  return out;
}

export const BUILTIN_PACKAGES: SystemPackage[] = Object.values(byPackage()).map(loadPackage);
export const DEFAULT_SYSTEM_ID = 'vtm-v20';
