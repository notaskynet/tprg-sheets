// Brand colour: a user preference (per device) over the system's default `accent`.
// Everything reads three CSS variables, so applying a colour is just setting them.
export const PRESETS = [
  { id: 'blood', hex: '#a01e2e' },
  { id: 'gold', hex: '#b8892e' },
  { id: 'emerald', hex: '#2f8f5b' },
  { id: 'indigo', hex: '#4a5bd0' },
  { id: 'violet', hex: '#8a4fc4' },
  { id: 'orange', hex: '#d2691e' },
] as const;

const KEY = 'trpg.accent';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function luminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Brighter hover/emphasis shade, and a text colour that stays readable on the brand fill. */
export function deriveAccent(hex: string): { brand: string; bright: string; onBrand: string } {
  const rgb = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(rgb);
  const contrastWhite = 1.05 / (luminance(rgb) + 0.05);
  return { brand: hex, bright: hslToHex(h, s, Math.min(0.68, l + 0.12)), onBrand: contrastWhite >= 3.5 ? '#ffffff' : '#14121a' };
}

export function applyAccent(hex: string | null | undefined): void {
  const el = document.documentElement.style;
  if (!hex) {
    ['--color-brand', '--color-brand-bright', '--color-on-brand'].forEach((v) => el.removeProperty(v));
    return;
  }
  const { brand, bright, onBrand } = deriveAccent(hex);
  el.setProperty('--color-brand', brand);
  el.setProperty('--color-brand-bright', bright);
  el.setProperty('--color-on-brand', onBrand);
}

export function getSavedAccent(): string | null {
  try { const v = localStorage.getItem(KEY); return v && /^#[0-9a-f]{6}$/i.test(v) ? v : null; } catch { return null; }
}

export function saveAccent(hex: string | null): void {
  try { hex ? localStorage.setItem(KEY, hex) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  applyAccent(hex);
}
