// Tiny typed localStorage helpers: namespaced keys, JSON-safe, never throw.
const NS = 'v20';

export function key(...parts: string[]): string {
  return [NS, ...parts].join('.');
}

export function readJSON<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(k: string, value: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readString(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

export function remove(k: string): void {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
